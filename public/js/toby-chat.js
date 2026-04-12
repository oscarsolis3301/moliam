/**
 * Toby chat widget — talks to /api/toby which proxies to Atlas.
 *
 *   - Non-streaming (simpler + reliable for a public demo).
 *   - Persists an optional user name in localStorage so Toby can address
 *     the visitor by name across turns AND across sessions.
 *   - On first use, asks for a name inline before the first message is sent.
 *   - The name is forwarded to Atlas as `user: { name, id }` on every request.
 */
(() => {
    "use strict";

    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    const body = document.getElementById("chat-body");
    const suggestions = document.querySelectorAll(".chat-suggestions button");

    if (!form || !input || !body) return;

    /* ---------- user identity ---------- */
    const LS_NAME = "moliam.toby.name";
    const LS_UID = "moliam.toby.uid";

    function loadUser() {
        try {
            return {
                name: (localStorage.getItem(LS_NAME) || "").trim(),
                id: (localStorage.getItem(LS_UID) || "").trim(),
            };
        } catch {
            return { name: "", id: "" };
        }
    }
    function saveUser(name) {
        try {
            const clean = (name || "").replace(/[<>]/g, "").trim().slice(0, 60);
            localStorage.setItem(LS_NAME, clean);
            if (!localStorage.getItem(LS_UID)) {
                // stable, opaque per-browser id (not a tracking cookie)
                const id =
                    "anon-" +
                    Math.random().toString(36).slice(2, 10) +
                    Date.now().toString(36).slice(-4);
                localStorage.setItem(LS_UID, id);
            }
            return clean;
        } catch {
            return (name || "").trim();
        }
    }

    let user = loadUser();
    let sessionId = null;
    const history = []; // { role, content }
    let busy = false;

    /* ---------- identity chip (visible above the chat body) ---------- */
    const head = document.querySelector(".chat-head");
    let chip;
    if (head) {
        chip = document.createElement("button");
        chip.type = "button";
        chip.className = "identity-chip";
        chip.setAttribute("aria-label", "Set or change your name");
        head.appendChild(chip);
        chip.addEventListener("click", () => promptForName({ reason: "change" }));
    }
    function renderChip() {
        if (!chip) return;
        if (user.name) {
            chip.innerHTML =
                '<span class="ic-label">As</span>' +
                '<span class="ic-name">' + esc(user.name) + "</span>" +
                '<span class="ic-edit" aria-hidden="true">✎</span>';
            chip.classList.add("set");
        } else {
            chip.innerHTML = '<span class="ic-label">Add your name</span>';
            chip.classList.remove("set");
        }
    }
    renderChip();

    /* ---------- helpers ---------- */
    function esc(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    function renderText(s) {
        let t = esc(s);
        t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        t = t.replace(/(^|\s)\*(.+?)\*(\s|$)/g, "$1<em>$2</em>$3");
        t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
        t = t.replace(/\n/g, "<br>");
        return t;
    }
    function addMsg(role, text) {
        const div = document.createElement("div");
        div.className = `msg ${role}`;
        div.innerHTML = renderText(text);
        body.appendChild(div);
        body.scrollTop = body.scrollHeight;
        return div;
    }
    function addTyping() {
        const div = document.createElement("div");
        div.className = "msg bot typing";
        div.innerHTML = "<span></span><span></span><span></span>";
        body.appendChild(div);
        body.scrollTop = body.scrollHeight;
        return div;
    }
    function renderActivity(activity) {
        if (!activity || !activity.length) return;
        const wrap = document.createElement("div");
        wrap.className = "msg bot activity-feed";
        let html = "";
        for (const a of activity) {
            let line = `<div class="af-entry">`;
            line += `<span class="af-icon">${esc(a.icon)}</span> `;
            line += `<span class="af-label">${esc(a.label)}</span>`;
            if (a.detail) line += ` <span class="af-detail">${esc(a.detail)}</span>`;
            if (a.sources && a.sources.length) {
                line += `<span class="af-sources">`;
                line += a.sources.map(s => `<span class="af-src">${esc(s)}</span>`).join("");
                line += `</span>`;
            }
            if (typeof a.found === "number" && a.found === 0) {
                line += ` <span class="af-none">no results</span>`;
            }
            line += `</div>`;
            html += line;
        }
        wrap.innerHTML = html;
        body.appendChild(wrap);
        body.scrollTop = body.scrollHeight;
    }
    function addError(text) {
        const div = document.createElement("div");
        div.className = "msg error";
        div.textContent = text;
        body.appendChild(div);
        body.scrollTop = body.scrollHeight;
    }

    /* ---------- inline name prompt ---------- */
    // A non-blocking inline question; lives inside the chat body so mobile
    // behaves. Resolves with the name (or "") if user skips.
    function promptForName({ reason = "first" } = {}) {
        return new Promise(resolve => {
            // Remove any existing prompt
            const existing = body.querySelector(".name-prompt");
            if (existing) existing.remove();

            const wrap = document.createElement("div");
            wrap.className = "name-prompt";
            wrap.innerHTML =
                '<div class="np-text">' +
                (reason === "first"
                    ? "Quick thing — what should I call you?"
                    : "What name should I use?") +
                "</div>" +
                '<div class="np-row">' +
                '<input type="text" class="np-input" maxlength="60" placeholder="Your name" autocomplete="given-name">' +
                '<button type="button" class="np-save">Save</button>' +
                "</div>" +
                '<button type="button" class="np-skip">' +
                (reason === "first" ? "Skip for now" : "Clear name") +
                "</button>";
            body.appendChild(wrap);
            body.scrollTop = body.scrollHeight;

            const inp = wrap.querySelector(".np-input");
            const save = wrap.querySelector(".np-save");
            const skip = wrap.querySelector(".np-skip");
            if (user.name) inp.value = user.name;
            setTimeout(() => inp.focus(), 50);

            function finish(name) {
                wrap.remove();
                if (name !== null) {
                    user.name = saveUser(name);
                    if (!user.id) user = loadUser();
                    renderChip();
                    if (name) {
                        addMsg(
                            "bot",
                            `Nice to meet you, **${name}**! What would you like to know?`
                        );
                    }
                }
                resolve(user.name || "");
            }
            save.addEventListener("click", () => {
                const v = inp.value.trim();
                finish(v || "");
            });
            skip.addEventListener("click", () => {
                if (reason === "change") {
                    // "Clear name" in change mode wipes the stored value
                    try { localStorage.removeItem(LS_NAME); } catch {}
                    user.name = "";
                    renderChip();
                    addMsg("bot", "Ok, I'll go back to being more formal.");
                }
                finish(null);
            });
            inp.addEventListener("keydown", e => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    save.click();
                }
            });
        });
    }

    /* ---------- send (streaming SSE) ---------- */
    async function send(text) {
        if (busy || !text.trim()) return;

        // First message with no name? Ask before sending.
        if (!user.name) {
            await promptForName({ reason: "first" });
        }

        busy = true;
        input.disabled = true;
        form.querySelector("button.send").disabled = true;

        addMsg("user", text);
        history.push({ role: "user", content: text });

        // Show thinking indicator while waiting for first event
        const thinking = addTyping();
        // Activity feed container — tool events appear here live
        let activityWrap = null;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 120_000);

            const payload = {
                messages: history.slice(-8),
                session_id: sessionId || undefined,
                stream: true,
            };
            if (user.name || user.id) {
                payload.user = {};
                if (user.name) payload.user.name = user.name;
                if (user.id) payload.user.id = user.id;
            }

            const res = await fetch("/api/toby", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!res.ok) {
                thinking.remove();
                const errBody = await res.json().catch(() => ({ error: "Unknown error" }));
                if (res.status === 429) {
                    addError("Whoa — slow down! Give it a minute before trying again.");
                } else {
                    addError(errBody.error || `Server error (${res.status})`);
                }
                return;
            }

            // Read SSE stream
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let botDiv = null;      // created on first token
            let accumulated = "";   // full reply text
            let buffer = "";        // partial SSE line buffer

            function ensureActivity() {
                if (!activityWrap) {
                    activityWrap = document.createElement("div");
                    activityWrap.className = "msg bot activity-feed";
                    body.appendChild(activityWrap);
                }
                return activityWrap;
            }

            function addActivityEntry(html) {
                const wrap = ensureActivity();
                const entry = document.createElement("div");
                entry.className = "af-entry";
                entry.innerHTML = html;
                wrap.appendChild(entry);
                body.scrollTop = body.scrollHeight;
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // keep incomplete last line

                for (const line of lines) {
                    // Handle named events (atlas.tool, atlas.tool_result)
                    if (line.startsWith("event: ")) {
                        const eventType = line.slice(7).trim();
                        // The next data: line carries the payload — peek ahead
                        // We'll handle it via the data line processing below
                        continue;
                    }

                    if (!line.startsWith("data: ")) continue;
                    const raw = line.slice(6).trim();
                    if (raw === "[DONE]") continue;

                    let evt;
                    try { evt = JSON.parse(raw); } catch { continue; }

                    // ── Tool call event (agent is searching) ──
                    if (evt.type === "tool_call") {
                        thinking.remove();
                        const icon = evt.name === "knowledge_search" ? "🔍"
                            : evt.name === "list_documents" ? "📄" : "⚙️";
                        const label = evt.name === "knowledge_search" ? "Searching knowledge base"
                            : evt.name === "list_documents" ? "Listing documents"
                            : evt.name === "recall_conversation" ? "Recalling conversation" : evt.name;
                        const query = (evt.arguments && evt.arguments.query) || "";
                        let html = `<span class="af-icon">${icon}</span> `;
                        html += `<span class="af-label">${esc(label)}</span>`;
                        if (query) html += ` <span class="af-detail">"${esc(query)}"</span>`;
                        html += ` <span class="af-spinner">⟳</span>`;
                        addActivityEntry(html);
                        continue;
                    }

                    // ── Tool result event (search finished) ──
                    if (evt.type === "tool_result") {
                        // Update the spinner to a checkmark on the last activity entry
                        if (activityWrap) {
                            const spinner = activityWrap.querySelector(".af-entry:last-child .af-spinner");
                            if (spinner) spinner.textContent = "✓";
                            // Try to show source count
                            try {
                                const parsed = JSON.parse(evt.content || "{}");
                                const results = parsed.results || [];
                                if (results.length > 0) {
                                    const srcSpan = document.createElement("span");
                                    srcSpan.className = "af-sources";
                                    srcSpan.innerHTML = results.slice(0, 4).map(r =>
                                        `<span class="af-src">${esc(r.title || "Untitled")}</span>`
                                    ).join("");
                                    const lastEntry = activityWrap.querySelector(".af-entry:last-child");
                                    if (lastEntry) lastEntry.appendChild(srcSpan);
                                }
                            } catch {}
                        }
                        body.scrollTop = body.scrollHeight;
                        continue;
                    }

                    // ── Token streaming (normal chat.completion.chunk) ──
                    if (evt.choices && evt.choices[0]) {
                        const delta = evt.choices[0].delta;
                        const finish = evt.choices[0].finish_reason;

                        if (delta && delta.content) {
                            thinking.remove();
                            if (!botDiv) {
                                botDiv = document.createElement("div");
                                botDiv.className = "msg bot";
                                body.appendChild(botDiv);
                            }
                            accumulated += delta.content;
                            botDiv.innerHTML = renderText(accumulated);
                            body.scrollTop = body.scrollHeight;
                        }

                        // Capture session_id from the final chunk
                        if (evt.session_id) sessionId = evt.session_id;
                        if (finish === "stop") break;
                    }

                    // ── Error event ──
                    if (evt.error) {
                        thinking.remove();
                        addError(evt.error.message || "Something went wrong.");
                    }
                }
            }

            thinking.remove();

            if (accumulated.trim()) {
                history.push({ role: "assistant", content: accumulated });
                while (history.length > 20) history.shift();
            } else if (!botDiv) {
                addError("Toby went quiet. Try rephrasing?");
            }
        } catch (err) {
            thinking.remove();
            if (err.name === "AbortError") {
                addError("That took too long. Try something shorter?");
            } else {
                addError("Couldn't reach Atlas. Check your connection and try again.");
            }
        } finally {
            busy = false;
            input.disabled = false;
            form.querySelector("button.send").disabled = false;
            input.focus();
        }
    }

    form.addEventListener("submit", e => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        send(text);
    });

    suggestions.forEach(btn => {
        btn.addEventListener("click", () => {
            const prompt = btn.dataset.prompt;
            if (prompt) send(prompt);
        });
    });

    // Keep the nav status dot honest — check Atlas health
    (async () => {
        try {
            const r = await fetch("/api/toby-health");
            const d = await r.json();
            const dot = document.querySelector(".nav .status-dot");
            if (!dot) return;
            if (!d.ok || d.status !== "healthy") {
                dot.style.background = "#ff6b6b";
                dot.style.boxShadow = "0 0 12px #ff6b6b";
                const label = document.getElementById("nav-status");
                if (label) label.lastChild.textContent = "Degraded";
            } else if (d.backends && d.backends.healthy) {
                const stat = document.getElementById("stat-backends");
                if (stat) stat.textContent = d.backends.healthy;
            }
        } catch {
            /* ignore */
        }
    })();
})();
