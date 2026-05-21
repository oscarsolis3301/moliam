import type { Request } from 'express';
import type { IncomingHttpHeaders } from 'node:http';

// Header names a reverse-proxy / harness might use to forward the
// authenticated user. We check a few common conventions so the same code
// works whether Clutch is mounted behind the FastAPI harness, an oauth2-proxy
// style sidecar, or run standalone.
const ACTOR_HEADERS = [
  'x-clutch-actor',
  'x-user-email',
  'x-forwarded-email',
  'x-forwarded-user',
  'x-auth-request-email',
  'x-auth-request-user',
  'remote-user',
];

const FALLBACK_ACTOR = 'local';

function pick(headers: IncomingHttpHeaders | Record<string, unknown>): string | null {
  for (const name of ACTOR_HEADERS) {
    const raw = (headers as Record<string, unknown>)[name];
    if (!raw) continue;
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

export function extractActorFromRequest(req: Request): string {
  return pick(req.headers) ?? FALLBACK_ACTOR;
}

export function extractActorFromHeaders(
  headers: IncomingHttpHeaders | Record<string, unknown>,
): string {
  return pick(headers) ?? FALLBACK_ACTOR;
}
