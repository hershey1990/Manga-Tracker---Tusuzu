import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { copySnapshot, readLocalSnapshot } from './sync';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const primaryUrl = process.env.TURSO_DATABASE_URL;
const remoteUrl =
  primaryUrl && !primaryUrl.startsWith('file:')
    ? primaryUrl
    : process.env.TURSO_DATABASE_URL_PROD;
const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_TOKEN;
const localPath = (process.env.LOCAL_DATABASE_URL ?? 'file:./local.db').replace(
  /^file:/,
  '',
);
const dryRun = process.argv.includes('--dry-run');

if (!dryRun && (!remoteUrl || remoteUrl.startsWith('file:'))) {
  console.error(
    'Configura TURSO_DATABASE_URL=libsql://... para empujar datos a Turso.',
  );
  process.exit(1);
}

if (!authToken && !dryRun) {
  console.error('Falta TURSO_AUTH_TOKEN.');
  process.exit(1);
}

if (!existsSync(localPath)) {
  console.error(`No existe la base local ${localPath}.`);
  process.exit(1);
}

const snapshot = readLocalSnapshot(localPath);
const totalRows = snapshot.reduce((sum, table) => sum + table.rows.length, 0);

console.log(`Origen: ${localPath}`);
console.log(`Turso:  ${remoteUrl ?? '(no configurado)'}`);
for (const table of snapshot) {
  console.log(`  ${table.table}: ${table.rows.length}`);
}
console.log(`Total: ${totalRows} filas`);

if (dryRun) {
  console.log('Dry run: no se escribió nada en Turso.');
  process.exit(0);
}

if (!remoteUrl || remoteUrl.startsWith('file:') || !authToken) {
  throw new Error('Configuración de Turso incompleta.');
}

const [{ createClient }, { applyRemoteMigrations }] = await Promise.all([
  import('@libsql/client/web'),
  import('./remote-migrate'),
]);

const client = createClient({ url: remoteUrl, authToken });

const newMigrations = await applyRemoteMigrations(client);
if (newMigrations > 0) {
  console.log(`Migraciones nuevas aplicadas en Turso: ${newMigrations}.`);
}

await copySnapshot(
  snapshot,
  async (statements) => {
    await client.batch(statements, 'write');
  },
  (table, rows) => {
    console.log(`  ${table}: ${rows} filas copiadas`);
  },
);

client.close();
console.log('Listo. Configura las mismas credenciales en Vercel.');
