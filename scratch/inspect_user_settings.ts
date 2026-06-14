import { DataRepository } from '../src/memory/database/repositories/data-repository.js';
import { getUserConfig, config } from '../src/config/index.js';
import { configSchema } from '../src/config/schema.js';
import pg from 'pg';

async function main() {
  const url = process.env.DATABASE_URL || config().database.url;
  console.log('Database URL:', url);

  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
  });

  // Get user details
  const usersRes = await pool.query('SELECT id, username FROM orbiter_users');
  console.log('\n--- Users in Database ---');
  console.log(usersRes.rows);

  if (usersRes.rows.length === 0) {
    console.error('No users found in database.');
    await pool.end();
    return;
  }

  const userId = usersRes.rows[0].id;
  const username = usersRes.rows[0].username;
  console.log(`\nInspecting settings for user: ${username} (${userId})`);

  // Query settings from DB directly
  const settingsRes = await pool.query(
    'SELECT key, value, value_type as "valueType" FROM orbiter_user_settings WHERE user_id = $1',
    [userId]
  );
  console.log('\n--- DB Settings ---');
  for (const row of settingsRes.rows) {
    console.log(`  ${row.key}: ${JSON.stringify(row.value)} (${row.valueType})`);
  }

  // Construct config structure manually as index.ts does
  const baseConfig = config();
  const merged: any = JSON.parse(JSON.stringify(baseConfig));

  for (const s of settingsRes.rows) {
    const parts = s.key.split('.');
    let current = merged;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    const lastPart = parts[parts.length - 1];
    let typedValue: any = s.value;
    if (s.valueType === 'number') {
      typedValue = Number(s.value);
    } else if (s.valueType === 'boolean') {
      typedValue = s.value === 'true';
    }
    current[lastPart] = typedValue;
  }

  console.log('\n--- Merged LLM config (Before validation) ---');
  console.log(JSON.stringify(merged.llm, null, 2));

  // Run safeParse and inspect error details
  const result = configSchema.safeParse(merged);
  if (result.success) {
    console.log('\n✅ Validation succeeded!');
  } else {
    console.log('\n❌ Validation failed!');
    console.log(JSON.stringify(result.error.format(), null, 2));
  }

  const finalConfig = await getUserConfig(userId);
  console.log('\n--- Final Config LLM settings (from getUserConfig) ---');
  console.log(JSON.stringify(finalConfig.llm, null, 2));

  await pool.end();
}

main().catch(console.error);
