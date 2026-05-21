import type { IncomingHttpHeaders } from 'node:http';
import { config } from './config.js';

// Derives the user-facing host URL from the originating HTTP request headers.
// This is the URL the host's browser actually used, which is what we want to
// embed in QR codes and "Join at …" lines on the lobby — NOT the LAN IPv4
// the server detected (which is wrong on a public deployment behind a proxy).
//
// Resolution order:
//   1. X-Forwarded-Proto + X-Forwarded-Host (set by every reverse proxy worth
//      using — Nginx, Caddy, Cloudflare, AWS ALB).
//   2. Host header (the bare TLD if no proxy headers exist) combined with the
//      protocol inferred from X-Forwarded-Proto or, lacking that, "https" if
//      we're in production.
//   3. config.publicHostUrl — the env-driven / LAN-detected fallback.
//
// In standalone-on-LAN mode the headers will be `Host: 192.168.1.124:8787`
// and that's exactly what we want — same as the previous behaviour. In
// production, the headers will be `X-Forwarded-Host: clutch.moliam.com` +
// `X-Forwarded-Proto: https` and we'll build the right public URL without
// requiring PUBLIC_HOST to be set.

function pickHeader(headers: IncomingHttpHeaders, name: string): string | null {
  const v = headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0] ?? null;
  if (typeof v === 'string' && v.trim()) return v.split(',')[0]!.trim();
  return null;
}

export function publicHostUrlFromHeaders(headers: IncomingHttpHeaders): string {
  const fwdHost = pickHeader(headers, 'x-forwarded-host');
  const fwdProto = pickHeader(headers, 'x-forwarded-proto');
  const host = pickHeader(headers, 'host');

  if (fwdHost) {
    const proto = fwdProto ?? (config.isProd ? 'https' : 'http');
    return `${proto}://${fwdHost}`.replace(/\/+$/, '');
  }
  if (host) {
    const proto = fwdProto ?? (config.isProd ? 'https' : 'http');
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return config.publicHostUrl;
}
