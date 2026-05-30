import pool from './db';
import { migrate } from './migrate';

/**
 * Initialize / update the database schema.
 *
 * This is now a thin wrapper around the migration runner. It is SAFE to run
 * repeatedly against a live database — it never drops tables or data, it only
 * applies pending, idempotent migrations from `migrations/*.sql`.
 */
export async function initDatabase(): Promise<void> {
  try {
    console.log('Initializing database (running migrations)...');
    await migrate();
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  initDatabase()
    .then(() => pool.end())
    .then(() => process.exit(0));
}
