import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

const { parseVaultNote } = await import('../src/features/import/parser');

const vaultArg =
  process.argv[2] ??
  process.env.VAULT_PATH ??
  'C:\\Obsidian Vault\\Surface Vault\\Mangas\\Series';
const vaultPath = resolve(vaultArg);
const outPath = resolve(process.argv[3] ?? 'vault-export.json');

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const files = (await readdir(vaultPath, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b, 'es'));

const records: import('../src/features/import/parser').VaultRecord[] = [];
const errors: { file: string; message: string }[] = [];

for (const file of files) {
  try {
    const markdown = await readFile(join(vaultPath, file), 'utf8');
    records.push(parseVaultNote(file, markdown));
  } catch (error) {
    errors.push({
      file,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

const payload = JSON.stringify(records, null, 2);
await writeFile(outPath, payload, 'utf8');

const statuses = new Map<string, number>();
for (const record of records) {
  statuses.set(record.status, (statuses.get(record.status) ?? 0) + 1);
}

console.log(`Leídos ${records.length} archivos de ${vaultPath}`);
for (const [status, count] of statuses) {
  console.log(`  ${status}: ${count}`);
}
console.log(`Exportado a ${outPath}`);
if (errors.length > 0) {
  console.error(`Errores: ${errors.length}`);
  for (const error of errors) {
    console.error(`  ${error.file}: ${error.message}`);
  }
}
