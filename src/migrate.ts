import fs from 'fs';
import path from 'path';
import pool from './db';

/**
 * Minimal forward-only SQL migration runner.
 *
 * - Applies `migrations/*.sql` in lexical order, once each.
 * - Records applied versions in `schema_migrations`.
 * - Each migration runs inside its own transaction, UNLESS the file starts
 *   with a `-- migrate:no-transaction` header (required for statements like
 *   `CREATE INDEX CONCURRENTLY` that cannot run inside a transaction block).
 *
 * It NEVER drops data: migrations are expected to be idempotent
 * (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 */

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const NO_TX_MARKER = 'migrate:no-transaction';

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

async function appliedVersions(): Promise<Set<string>> {
  const res = await pool.query('SELECT version FROM schema_migrations');
  return new Set(res.rows.map((r) => r.version as string));
}

function loadMigrations(): { version: string; sql: string; useTransaction: boolean }[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const version = file.replace(/\.sql$/, '');
      const useTransaction = !sql.slice(0, 200).includes(NO_TX_MARKER);
      return { version, sql, useTransaction };
    });
}

async function applyInTransaction(version: string, sql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function applyWithoutTransaction(version: string, sql: string): Promise<void> {
  // No BEGIN/COMMIT — used for CONCURRENTLY etc. Recorded only on success.
  await pool.query(sql);
  await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
}

export async function migrate(): Promise<void> {
  await ensureMigrationsTable();
  const done = await appliedVersions();
  const migrations = loadMigrations();

  const pending = migrations.filter((m) => !done.has(m.version));
  if (pending.length === 0) {
    console.log('Migrations: nothing to apply (database is up to date).');
    return;
  }

  console.log(`Migrations: applying ${pending.length} pending migration(s)...`);
  for (const m of migrations) {
    if (done.has(m.version)) {
      console.log(`  - skip ${m.version} (already applied)`);
      continue;
    }
    process.stdout.write(`  - apply ${m.version}${m.useTransaction ? '' : ' (no transaction)'}... `);
    if (m.useTransaction) {
      await applyInTransaction(m.version, m.sql);
    } else {
      await applyWithoutTransaction(m.version, m.sql);
    }
    console.log('done');
  }
  console.log('Migrations: complete.');
}

if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      pool.end().finally(() => process.exit(1));
    });
}
