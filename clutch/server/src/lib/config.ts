import 'dotenv/config';
import { join } from 'node:path';
import { detectLanIPv4 } from './network.js';

const port = Number(process.env.PORT ?? 3000);

/**
 * The URL that players will load on their phones. Used to build the QR code
 * and the "join at" text on the lobby screen.
 *
 * Priority:
 *   1. PUBLIC_HOST env var (use this if auto-detection picks the wrong NIC)
 *   2. Auto-detected LAN IPv4 on this machine
 *   3. Fall back to localhost (phones won't be able to reach it — warn in logs)
 */
function resolvePublicHost(): { url: string; source: 'env' | 'auto' | 'fallback' } {
  const raw = process.env.PUBLIC_HOST?.trim();
  if (raw) {
    // Accept either a full URL or a bare host[:port]; normalize to a URL.
    const url = raw.startsWith('http://') || raw.startsWith('https://')
      ? raw.replace(/\/+$/, '')
      : `http://${raw.replace(/\/+$/, '')}`;
    return { url, source: 'env' };
  }
  const ip = detectLanIPv4();
  if (ip) return { url: `http://${ip}:${port}`, source: 'auto' };
  return { url: `http://localhost:${port}`, source: 'fallback' };
}

const publicHost = resolvePublicHost();

export const config = {
  port,
  host: process.env.HOST ?? '0.0.0.0',
  dbPath: process.env.DB_PATH ?? join(process.cwd(), 'data', 'quiz.db'),
  publicDir: process.env.PUBLIC_DIR ?? join(process.cwd(), 'server', 'public'),
  isProd: process.env.NODE_ENV === 'production',
  publicHostUrl: publicHost.url,
  publicHostSource: publicHost.source,
};
