import { Client } from 'pg';

async function test() {
  const client = new Client({
    connectionString: 'postgresql://platform:platform@127.0.0.1:5432/platform_dev',
  });
  try {
    await client.connect();
    console.log('✅ Successfully connected to PostgreSQL via pg client!');
    const res = await client.query('SELECT version();');
    console.log('PostgreSQL version:', res.rows[0].version);
    await client.end();
  } catch (err) {
    console.error('❌ Connection error:', err);
  }
}

test();
