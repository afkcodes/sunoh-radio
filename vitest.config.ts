import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // DB-backed test files share one Postgres and TRUNCATE in setup, so run
    // test files sequentially (not in parallel) to avoid clobbering each other.
    fileParallelism: false,
  },
});
