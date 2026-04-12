/** Quick sanity endpoint for the landing page to show Atlas status. */
export async function onRequestGet({ env }) {
    const base = env.ATLAS_BASE_URL || "https://atlas.moliam.com";
    try {
        const r = await fetch(`${base}/healthz`);
        const data = await r.json();
        return new Response(
            JSON.stringify({
                ok: r.ok,
                status: data.status || "unknown",
                backends: data.backends || null,
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=15",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (e) {
        return new Response(
            JSON.stringify({ ok: false, error: String(e) }),
            { status: 502, headers: { "Content-Type": "application/json" } }
        );
    }
}
