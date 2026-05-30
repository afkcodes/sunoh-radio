import { Pool } from 'pg';
import { config } from './config';

const pool = new Pool({
  user: config.db.user,
  host: config.db.host,
  database: config.db.database,
  password: config.db.password,
  port: config.db.port,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
});

// Surface unexpected idle-client errors instead of crashing silently.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);

export const closePool = () => pool.end();

export default pool;
