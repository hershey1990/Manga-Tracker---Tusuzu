import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { DatabaseSync } from 'node:sqlite';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const file = (process.env.TURSO_DATABASE_URL ?? 'file:./local.db')
  .replace(/^file:/, '')
  .replace(/^\//, '');

if (!existsSync(file)) {
  console.error(`No existe ${file}.`);
  process.exit(1);
}

const sqlite = new DatabaseSync(file);
for (const mode of ['TRUNCATE', 'FULL', 'PASSIVE']) {
  try {
    sqlite.exec(`PRAGMA wal_checkpoint(${mode});`);
    break;
  } catch {
    // Otro proceso puede tener la base abierta; se intenta un modo más suave.
  }
}
sqlite.close();
console.log(`WAL consolidado en ${file}. Ya puedes copiar el archivo.`);
