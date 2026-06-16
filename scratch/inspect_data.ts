import pg from 'pg';
import { config } from '../src/config/index.js';

async function main() {
  const url = config().database.url;
  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query('SELECT * FROM orbiter_outputs');
    console.log('Outputs rows:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
