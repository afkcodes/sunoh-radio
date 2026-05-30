import pool, { closePool, query } from './db';

/**
 * Print live database counts. Read-only — safe to run against any environment.
 *   npm run stats
 */
async function printStats(): Promise<void> {
  const totals = await query(
    `SELECT
       count(*)::int                                            AS total,
       count(*) FILTER (WHERE status = 'working')::int          AS working,
       count(*) FILTER (WHERE status = 'broken')::int           AS broken,
       count(*) FILTER (WHERE status = 'untested')::int         AS untested,
       count(*) FILTER (WHERE image_hosted IS NOT NULL)::int    AS images_hosted
     FROM radio_stations`,
  );

  const distinct = await query(
    `SELECT
       (SELECT count(*)::int FROM (SELECT DISTINCT unnest(countries) FROM radio_stations WHERE status='working') c) AS countries,
       (SELECT count(*)::int FROM (SELECT DISTINCT unnest(genres)    FROM radio_stations WHERE status='working') g) AS genres`,
  );

  const t = totals.rows[0];
  const d = distinct.rows[0];

  console.log('\nradio_stations');
  console.log('-'.repeat(34));
  console.log(`Total rows:        ${t.total}`);
  console.log(`  working:         ${t.working}`);
  console.log(`  broken:          ${t.broken}`);
  console.log(`  untested:        ${t.untested}`);
  console.log(`Images hosted:     ${t.images_hosted}`);
  console.log(`Countries (work.): ${d.countries}`);
  console.log(`Genres (work.):    ${d.genres}`);
  console.log('-'.repeat(34));
}

printStats()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((err) => {
    if (err?.code === 'ECONNREFUSED' || err?.code === '42P01') {
      console.error(
        '\nCould not read stats. Is the database up and migrated?\n' +
          '  - start it (e.g. `npm run docker:up`)\n' +
          '  - then run `npm run migrate`\n',
      );
    } else {
      console.error('Error reading stats:', err);
    }
    void pool.end().finally(() => process.exit(1));
  });
