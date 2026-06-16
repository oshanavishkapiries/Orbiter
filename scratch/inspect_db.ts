import pg from 'pg';
import { config } from '../src/config/index.js';

async function main() {
  const url = config().database.url;
  console.log('Connecting to:', url);

  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const tablesRes = await pool.query(`
      SELECT tablename FROM pg_catalog.pg_tables 
      WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';
    `);
    console.log('Tables:', tablesRes.rows.map(r => r.tablename));

    for (const table of tablesRes.rows.map(r => r.tablename)) {
      const countRes = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`Table ${table} has ${countRes.rows[0].count} rows`);
    }

    const sessionsRes = await pool.query('SELECT * FROM orbiter_sessions LIMIT 5');
    console.log('Sessions Sample:', sessionsRes.rows);

  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await pool.end();
  }
}

main();
