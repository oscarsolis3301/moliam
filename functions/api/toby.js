/**
 * Toby chat proxy — server-side wrapper around Atlas /v1/chat/completions.
 *
 *  - Keeps ATLAS_PUBLIC_DEMO_KEY out of client JS.
 *  - Adds naive per-IP rate limiting (in-memory, best effort).
 *  - Strict input validation + length caps.
 *  - Streams the Atlas response back as Server-Sent Events.
 *  - Never calls tools that modify data (search only, via the tenant's system prompt).
 *
 * Environment variables:
 *   ATLAS_PUBLIC_DEMO_KEY   the sk-atl-... key for the public-demo tenant
 *   ATLAS_BASE_URL          default https://atlas.moliam.com
 */

const MAX_MESSAGE_LEN = 600;          // chars per user message
const MAX_HISTORY = 10;               // trailing turns kept
const MAX_TOKENS = 400;               // cap on response length
const RATE_WINDOW_MS = 60_000;        // 60s
const RATE_LIMIT = 15;                // requests per window per IP

// Cloudflare Workers run as short-lived isolates; this Map survives between
// requests within the same isolate, which is "good enough" for a demo rate limit.
const rateState = new Map();

function checkRate(ip) {
    const now = Date.now();
    const rec = rateState.get(ip) || { count: 0, reset: now + RATE_WINDOW_MS };
    if (now > rec.reset) {
        rec.count = 0;
        rec.reset = now + RATE_WINDOW_MS;
    }
    rec.count += 1;
    rateState.set(ip, rec);
    return rec.count <= RATE_LIMIT;
}

function json(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
            ...extraHeaders,
        },
    });
}

function sanitizeMessage(m) {
    if (!m || typeof m !== "object") return null;
    const role = typeof m.role === "string" ? m.role : "";
    if (role !== "user" && role !== "assistant") return null;
    let content = typeof m.content === "string" ? m.content : "";
    content = content.slice(0, MAX_MESSAGE_LEN);
    if (!content.trim()) return null;
    return { role, content };
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    });
}

export async function onRequestPost({ request, env }) {
    const ATLAS_KEY = env.ATLAS_PUBLIC_DEMO_KEY;
    const ATLAS_BASE = env.ATLAS_BASE_URL || "https://atlas.moliam.com";

    if (!ATLAS_KEY) {
        return json({ error: "Atlas key not configured on server" }, 500);
    }

    // Rate limit
    const ip =
        request.headers.get("CF-Connecting-IP") ||
        request.headers.get("X-Forwarded-For") ||
        "anon";
    if (!checkRate(ip)) {
        return json(
            { error: "Rate limit exceeded. Give it a minute." },
            429,
            { "Retry-After": "60" }
        );
    }

    // Parse
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON" }, 400);
    }
    if (!body || !Array.isArray(body.messages)) {
        return json({ error: "Missing messages array" }, 400);
    }

    const messages = body.messages
        .map(sanitizeMessage)
        .filter(Boolean)
        .slice(-MAX_HISTORY);

    if (!messages.length) {
        return json({ error: "No valid messages" }, 400);
    }

    const stream = body.stream === true;
    const session_id =
        typeof body.session_id === "string" && body.session_id.length < 100
            ? body.session_id
            : undefined;

    // Sanitize optional user identity. Accepts either an object or a plain string.
    // We only forward a small, hand-picked surface — no free-form metadata from the
    // client, and we strip anything that looks like control characters or HTML.
    function cleanName(s) {
        if (typeof s !== "string") return "";
        return s
            .replace(/<[^>]*>/g, "")
            .replace(/[\u0000-\u001F\u007F]+/g, " ")
            .trim()
            .slice(0, 80);
    }
    let atlasUser;
    if (body.user && typeof body.user === "object") {
        const name = cleanName(body.user.name);
        const id = cleanName(body.user.id);
        if (name || id) {
            atlasUser = {};
            if (name) atlasUser.name = name;
            if (id) atlasUser.id = id;
        }
    } else if (typeof body.user === "string") {
        const id = cleanName(body.user);
        if (id) atlasUser = { id };
    }

    // Forward to Atlas
    const atlasPayload = {
        messages,
        stream,
        max_tokens: MAX_TOKENS,
        use_knowledge_base: true,
        save_session: !!session_id,
        ...(session_id ? { session_id } : {}),
        ...(atlasUser ? { user: atlasUser } : {}),
    };

    let upstream;
    try {
        upstream = await fetch(`${ATLAS_BASE}/v1/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ATLAS_KEY}`,
            },
            body: JSON.stringify(atlasPayload),
        });
    } catch (e) {
        return json({ error: "Atlas upstream unreachable", detail: String(e) }, 502);
    }

    if (!upstream.ok) {
        const text = await upstream.text();
        return json(
            { error: `Atlas error ${upstream.status}`, detail: text.slice(0, 500) },
            502
        );
    }

    if (stream) {
        return new Response(upstream.body, {
            status: 200,
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-store, no-transform",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "X-Accel-Buffering": "no",
            },
        });
    }

    const data = await upstream.json();
    // Return a slimmed-down response — hide raw tool internals, keep text + activity feed
    const choice = (data.choices && data.choices[0]) || {};
    return json({
        reply: (choice.message && choice.message.content) || "",
        session_id: data.session_id || null,
        usage: data.usage || null,
        activity: data.activity || [],
    });
}
