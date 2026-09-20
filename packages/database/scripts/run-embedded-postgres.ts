import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';

async function main() {
  console.log('🚀 Initializing fresh embedded PostgreSQL cluster...');

  const databaseDir = path.join(process.cwd(), '.pgdata');

  if (fs.existsSync(databaseDir)) {
    fs.rmSync(databaseDir, { recursive: true, force: true });
  }
  fs.mkdirSync(databaseDir, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir,
    port: 5432,
    user: 'platform',
    password: 'platform',
    persistent: true,
  });

  await pg.initialise();
  await pg.start();

  console.log('✅ PostgreSQL engine started with superuser "platform" on port 5432!');

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
