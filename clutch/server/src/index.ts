import express from 'express';
import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { closeDb, initDb } from './db/connection.js';
import { quizzesRouter } from './routes/quizzes.js';
import { sessionsRouter } from './routes/sessions.js';
import { auditRouter } from './routes/audit.js';
import { hostAuthRouter } from './routes/host-auth.js';
import { attachSocketHandlers } from './sockets/index.js';
import { GameEngine } from './game/engine.js';
import { markAllActiveSessionsEnded } from './db/repositories/sessions.js';

const startedAt = Date.now();
initDb(config.dbPath);

const app = express();
app.use(express.json({ limit: '1mb' }));

if (config.isProd) {
  app.use((req, res, next) => {
    // Same-origin only in prod: block cross-origin browsers with a simple Origin check.
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (origin && host && !origin.endsWith(host)) {
      return res.status(403).json({ ok: false, error: 'Cross-origin request blocked' });
    }
    return next();
  });
}

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    uptime: Math.round((Date.now() - startedAt) / 1000),
    activeSessions: engine.activeSessionCount(),
  });
});

// Standalone identity stub. In the atlas/FastAPI harness, /api/me is served
// by the harness before requests reach this server. Running on its own there
// is no auth layer, so the local user is implicitly the admin.
app.get('/api/me', (_req, res) => {
  res.json({ ok: true, isAdmin: true });
});

app.use('/api/quizzes', quizzesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/host-auth', hostAuthRouter);
// The /api/template path was requested in the spec — mirror /api/quizzes/template.
app.get('/api/template', (_req, res) => res.redirect('/api/quizzes/template'));

const httpServer = createServer(app);
const io = new IOServer(httpServer, {
  cors: config.isProd ? { origin: false } : { origin: true, credentials: true },
  serveClient: false,
});

const engine = new GameEngine({
  emit: (room, event, payload) => {
    io.to(room).emit(event, payload);
  },
});

attachSocketHandlers(io, engine);

// Static client. In prod we serve built files; in dev Vite serves on :5173.
if (existsSync(config.publicDir)) {
  // Catches stale builds whose index.html points at the wrong asset prefix
  // (most commonly: a build run with the harness's `/clutch-app/` base, then
  // launched standalone at `/`). Without this warning the symptom is an
  // infinite "Loading Clutch" because the SPA fallback returns index.html as
  // text/html for the missing /clutch-app/assets/...js, which the browser
  // then refuses to execute as a module.
  verifyClientBuild();

  // Hashed bundle files (e.g. /assets/main-BaG55IYn.js) are content-addressed
  // so we can cache them aggressively. Everything else — including index.html
  // and the SPA fallback — must be no-cache so phones never render a stale
  // shell that references asset hashes from a prior build (which 404 and
  // produce an unstyled page after a rebuild).
  app.use('/assets', express.static(`${config.publicDir}/assets`, {
    maxAge: '1y',
    immutable: true,
    index: false,
  }));
  app.use(express.static(config.publicDir, {
    index: false,
    setHeaders: (res, path) => {
      if (path.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path === '/healthz') {
      return next();
    }
    // Asset-looking requests must NEVER fall back to index.html. If a JS/CSS
    // bundle 404s, returning an HTML doc as `text/html` makes the browser
    // throw "MIME type mismatch" with no hint as to the real cause. A clean
    // 404 surfaces the underlying problem (stale build, wrong base path)
    // immediately in dev tools instead.
    if (looksLikeStaticAsset(req.path)) {
      return res.status(404).type('text/plain').send('Not found');
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile('index.html', { root: config.publicDir });
  });
} else {
  logger.warn({ publicDir: config.publicDir }, 'public dir missing — run `npm run build:client`');
}

function looksLikeStaticAsset(path: string): boolean {
  if (path.startsWith('/assets/')) return true;
  // Common static-asset extensions. Anything with one of these is bundle-like
  // and should never resolve to the SPA shell.
  return /\.(?:js|mjs|css|map|json|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|wasm)$/i.test(path);
}

function verifyClientBuild(): void {
  const indexPath = join(config.publicDir, 'index.html');
  if (!existsSync(indexPath)) {
    logger.warn({ indexPath }, 'index.html missing — run `npm run build:client`');
    return;
  }
  let html: string;
  try {
    html = readFileSync(indexPath, 'utf8');
  } catch (err) {
    logger.warn({ err, indexPath }, 'could not read index.html');
    return;
  }
  // Pull the first asset href/src out of index.html. Vite emits exactly this
  // shape: src="/<base>assets/main-<hash>.js". We just need to confirm the
  // emitted base is "/" — anything else (e.g. /clutch-app/) means the build
  // was made for a different mount point and assets won't resolve here.
  const m = html.match(/(?:src|href)="([^"]*\/assets\/[^"]+)"/);
  if (!m) return; // unusual layout — don't second-guess
  const assetUrl = m[1] ?? '';
  if (!assetUrl.startsWith('/assets/')) {
    const wrongBase = assetUrl.replace(/\/assets\/.*$/, '/');
    logger.error(
      { assetUrl, expectedBase: '/', wrongBase },
      `client build was made for base "${wrongBase}" but server serves at "/". ` +
        'Asset requests will 404. Rebuild with `VITE_BASE=/ npm run build:client` ' +
        'or relaunch via `node apps/run.mjs` (which sets VITE_BASE automatically).',
    );
  }
}

// ---------- startup ----------
httpServer.listen(config.port, config.host, () => {
  const localUrl = `http://localhost:${config.port}`;
  const networkUrl = config.publicHostUrl;
  const networkLine =
    config.publicHostSource === 'fallback'
      ? `${networkUrl}  (no LAN IP detected — set PUBLIC_HOST to reach from phones)`
      : config.publicHostSource === 'env'
        ? `${networkUrl}  (from PUBLIC_HOST)`
        : networkUrl;

  const banner = [
    '',
    '  Clutch is ready.',
    '',
    `    Local:   ${localUrl}`,
    `    Network: ${networkLine}`,
    '',
    config.isProd ? '  Running in production mode.' : '  Running in development mode.',
    '',
  ].join('\n');
  // eslint-disable-next-line no-console
  console.log(banner);

  logger.info(
    { port: config.port, host: config.host, publicHostUrl: config.publicHostUrl, source: config.publicHostSource },
    'Clutch server ready',
  );
});

// ---------- graceful shutdown ----------
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutdown initiated');

  const forceTimeout = setTimeout(() => {
    logger.warn('forced exit after 10s');
    process.exit(1);
  }, 10_000);
  forceTimeout.unref();

  // Finalize in-memory sessions.
  engine.finalizeAll();
  markAllActiveSessionsEnded();

  io.close((err) => {
    if (err) logger.error({ err }, 'socket.io close error');
    httpServer.close(() => {
      try {
        closeDb();
      } catch (err) {
        logger.error({ err }, 'db close error');
      }
      logger.info('shutdown complete');
      clearTimeout(forceTimeout);
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
});
