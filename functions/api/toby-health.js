/**
 * Quick sanity endpoint for the landing page to show Atlas status.


 */

import { jsonResp } from './lib/standalone.js';

export async function onRequestGet({ request, env }) {
  try {
    const base = env.ATLAS_BASE_URL || "https://atlas.moliam.com";
    const r = await fetch(`${base}/healthz`);
    const data = await r.json();

    if (r.ok) {
      return jsonResp(200, { ok: true, status: data.status || 'unknown', backends: data.backends || null }, new Request(`http://localhost${env?.MOLIAM_DB ? '/health' : ''}`, { headers: request.headers }));
    } else {
      return jsonResp(502, { ok: false, status: data.status || 'unknown', error: `Atlas returned status ${r.status}` }, request);
    }
  } catch (e) {
    return jsonResp(502, { ok: false, error: e.message || String(e) }, request);
  }
}

