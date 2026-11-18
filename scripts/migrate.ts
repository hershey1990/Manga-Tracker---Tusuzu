import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const rawUrl = process.env.TURSO_DATABASE_URL ?? 'file:./local.db';
const isRemote = !rawUrl.startsWith('file:');

if (isRemote) {
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!authToken) {
    console.error('Falta TURSO_AUTH_TOKEN para migrar Turso.');
    process.exit(1);
  }
  const [{ createClient }, { applyRemoteMigrations }] = await Promise.all([
    import('@libsql/client/web'),
    import('./remote-migrate'),
  ]);
  const client = createClient({ url: rawUrl, authToken });
  const count = await applyRemoteMigrations(client);
  client.close();
  console.log(
    `Migraciones aplicadas en Turso (${count} ${count === 1 ? 'nueva' : 'nuevas'}).`,
  );
} else {
  const { applyLocalMigrations } = await import('./local-migrate');
  applyLocalMigrations(rawUrl.replace(/^file:/, '') || './local.db');
  console.log(`Migraciones aplicadas en ${rawUrl}.`);
}

process.exit(0);
