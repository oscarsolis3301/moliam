import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { logger } from '../lib/logger.js';

// Host-mode PIN gate.
//
// The PIN itself lives in env (`HOST_PIN`, default "3301") so it can be rotated
// without rebuilding. A successful POST returns a short opaque token signed
// with a per-process secret; the client persists it in localStorage to skip
// the gate on return visits. The token has a 30-day soft expiry built in —
// long enough for "remember me", short enough that a leaked token decays.
//
// Brute-force defence: per-IP attempt counter resets on success. After 5
// failed attempts within any 5-minute window, the IP is locked for 5 minutes.

export const hostAuthRouter = Router();

const HOST_PIN = (process.env.HOST_PIN ?? '3301').trim();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60_000;
const TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;

// Per-process HMAC secret. Stable across requests until the server restarts —
// restart invalidates outstanding tokens, which is fine: the PIN is shared and
// re-entry is one prompt away.
const SECRET = randomBytes(32);

interface AttemptState {
  fails: number;
  firstFailAt: number;
  lockedUntil: number; // 0 = not locked
}
const attempts = new Map<string, AttemptState>();

function clientKey(req: Request): string {
  // Express's req.ip respects `trust proxy`. Behind the FastAPI harness this
  // resolves to the original client IP. Fall back to the socket address.
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function getState(key: string): AttemptState {
  const now = Date.now();
  const cur = attempts.get(key);
  if (!cur) {
    const fresh = { fails: 0, firstFailAt: 0, lockedUntil: 0 };
    attempts.set(key, fresh);
    return fresh;
  }
  // Lockout expired — reset.
  if (cur.lockedUntil && cur.lockedUntil <= now) {
    cur.fails = 0;
    cur.firstFailAt = 0;
    cur.lockedUntil = 0;
  }
  // Failed-attempts window is the same as the lockout window — old fails age out.
  if (cur.firstFailAt && now - cur.firstFailAt > LOCKOUT_MS) {
    cur.fails = 0;
    cur.firstFailAt = 0;
  }
  return cur;
}

function makeToken(): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + TOKEN_TTL_MS;
  const payload = `${issuedAt}.${expiresAt}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyHostToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [issuedAt, expiresAt, sig] = parts;
  if (!issuedAt || !expiresAt || !sig) return false;
  const exp = Number(expiresAt);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  const expected = createHmac('sha256', SECRET).update(`${issuedAt}.${expiresAt}`).digest('hex');
  // Constant-time comparison to avoid timing leaks. Both buffers must match
  // length first, otherwise timingSafeEqual throws.
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const VerifyBody = z.object({ pin: z.string().min(1).max(64) });

hostAuthRouter.post('/verify', (req: Request, res: Response) => {
  const key = clientKey(req);
  const state = getState(key);
  const now = Date.now();

  if (state.lockedUntil && state.lockedUntil > now) {
    const retryAfterMs = state.lockedUntil - now;
    return res.status(429).json({
      ok: false,
      reason: 'Too many attempts. Try again later.',
      retryAfterMs,
      remainingAttempts: 0,
    });
  }

  const parsed = VerifyBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, reason: 'PIN is required.' });
  }

  // Constant-time PIN compare. Mismatched lengths short-circuit to "wrong" so
  // the timing reveals nothing.
  const submitted = parsed.data.pin.trim();
  let correct = false;
  if (submitted.length === HOST_PIN.length) {
    const a = Buffer.from(submitted, 'utf8');
    const b = Buffer.from(HOST_PIN, 'utf8');
    correct = timingSafeEqual(a, b);
  }

  if (!correct) {
    if (state.fails === 0) state.firstFailAt = now;
    state.fails++;
    if (state.fails >= MAX_ATTEMPTS) {
      state.lockedUntil = now + LOCKOUT_MS;
      logger.warn({ key, fails: state.fails }, 'host-auth: lockout engaged');
      return res.status(429).json({
        ok: false,
        reason: 'Too many attempts. Locked for 5 minutes.',
        retryAfterMs: LOCKOUT_MS,
        remainingAttempts: 0,
      });
    }
    return res.status(401).json({
      ok: false,
      reason: 'Incorrect PIN.',
      remainingAttempts: MAX_ATTEMPTS - state.fails,
    });
  }

  // Success: clear counter, mint a token.
  state.fails = 0;
  state.firstFailAt = 0;
  state.lockedUntil = 0;
  const token = makeToken();
  logger.info({ key }, 'host-auth: success');
  return res.json({ ok: true, token, expiresInMs: TOKEN_TTL_MS });
});

// Lightweight check used by the client to validate a remembered token without
// re-prompting. Returns ok:true if the token is still good.
hostAuthRouter.post('/check', (req: Request, res: Response) => {
  const token = (req.body as { token?: unknown } | null)?.token;
  if (verifyHostToken(typeof token === 'string' ? token : null)) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, reason: 'Token invalid or expired.' });
});

// State endpoint so the UI can show the lockout countdown without making a
// failing verify request.
hostAuthRouter.get('/state', (req: Request, res: Response) => {
  const state = getState(clientKey(req));
  const now = Date.now();
  const lockedFor = state.lockedUntil > now ? state.lockedUntil - now : 0;
  return res.json({
    ok: true,
    locked: lockedFor > 0,
    lockedFor,
    remainingAttempts: lockedFor > 0 ? 0 : MAX_ATTEMPTS - state.fails,
    maxAttempts: MAX_ATTEMPTS,
  });
});
