import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';

async function main() {
  const databaseDir = path.join(process.cwd(), '.pgdata');

  if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
  }

  const pg = new EmbeddedPostgres({
    databaseDir,
    port: 5432,
    user: 'platform',
    password: 'platform',
    persistent: true,
  });

  const isInitialized = fs.existsSync(path.join(databaseDir, 'PG_VERSION'));
  if (!isInitialized) {
    const files = fs.readdirSync(databaseDir);
    if (files.length > 0) {
      fs.rmSync(databaseDir, { recursive: true, force: true });
      fs.mkdirSync(databaseDir, { recursive: true });
    }
    console.log('🌱 Initializing new PostgreSQL cluster...');
    await pg.initialise();
  }

  console.log('🚀 Starting PostgreSQL server on port 5432...');
  await pg.start();
  console.log('✅ PostgreSQL is running on port 5432 (user: platform, pass: platform)!');

  process.on('SIGINT', async () => {
    console.log('Stopping PostgreSQL...');
    await pg.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Stopping PostgreSQL...');
    await pg.stop();
    process.exit(0);
  });

  setInterval(() => {}, 10000);
}

main().catch((err) => {
  console.error('❌ Failed to start embedded PostgreSQL:', err);
  process.exit(1);
});
