import Database, { type Database as Db } from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Db | null = null;

export function getDb(): Db {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  return db;
}

export function initDb(dbPath: string): Db {
  if (db) return db;
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  logger.info({ dbPath }, 'database ready');
  return db;
}

function runMigrations(conn: Db): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT PRIMARY KEY,
      applied_at  INTEGER NOT NULL
    );
  `);

  const migrationsDir = resolveMigrationsDir();
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    conn
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((r) => (r as { version: string }).version),
  );

  const insertMig = conn.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    conn.transaction(() => {
      conn.exec(sql);
      insertMig.run(file, Date.now());
    })();
    logger.info({ migration: file }, 'migration applied');
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function resolveMigrationsDir(): string {
  // Tried in order:
  //   1. sibling "migrations" dir next to this file (works for tsx dev)
  //   2. project-root /server/src/migrations (works for compiled dist, since we
  //      do NOT copy the .sql files into the dist tree)
  //   3. env override
  const envPath = process.env.MIGRATIONS_DIR;
  if (envPath && existsSync(envPath)) return envPath;

  const sibling = join(__dirname, '..', 'migrations');
  if (existsSync(sibling)) return sibling;

  const rootRelative = join(process.cwd(), 'server', 'src', 'migrations');
  if (existsSync(rootRelative)) return rootRelative;

  throw new Error(
    `Could not locate migrations directory. Tried: ${sibling}, ${rootRelative}. ` +
      `Set MIGRATIONS_DIR to override.`,
  );
}
