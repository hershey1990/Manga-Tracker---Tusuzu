import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const args = process.argv.slice(2);
const argValue = (name: string) =>
  args
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');

const email = argValue('email') ?? process.env.IMPORT_EMAIL;
const file = argValue('file') ?? 'vault-export.json';
const enrich = args.includes('--enrich');

if (!existsSync(file)) {
  console.error(`No existe ${file}. Genera uno con npm run vault:export.`);
  process.exit(1);
}

const { db } = await import('../src/lib/db/client');
const { eq, asc } = await import('drizzle-orm');
const { user } = await import('../src/lib/db/schema');
const { vaultExportSchema } = await import('../src/features/import/parser');
const { applyImport, createPreview } = await import(
  '../src/features/import/importer'
);
const { enrichUnlinkedBatch } = await import(
  '../src/features/series/enrichment'
);

const [target] = email
  ? await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
  : await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .orderBy(asc(user.createdAt))
      .limit(1);

if (!target) {
  console.error('No hay usuario destino. Registra una cuenta primero.');
  process.exit(1);
}

const payload = JSON.parse(await readFile(file, 'utf8')) as unknown;
const parsed = vaultExportSchema.safeParse(payload);
if (!parsed.success) {
  console.error(`JSON inválido: ${parsed.error.issues[0]?.message}`);
  process.exit(1);
}

console.log(`Usuario: ${target.email}`);
console.log(`Archivo: ${file} (${parsed.data.length} registros)`);

const preview = await createPreview(target.id, parsed.data, 'obsidian-cli');
console.log(
  `Vista previa: ${preview.newCount} nuevas · ${preview.duplicateCount} duplicadas · ${preview.existingCount} ya existentes`,
);

if (preview.newCount === 0) {
  console.log('Nada nuevo que importar.');
} else {
  const report = await applyImport(target.id, preview.jobId);
  console.log(
    `Importadas ${report.imported} · Omitidas ${report.skipped} · Fallidas ${report.failed}`,
  );
}

if (!enrich) {
  console.log(
    `Siguiente paso: npm run enrich:library -- --email=${target.email}`,
  );
  process.exit(0);
}

let processed = 0;
let matched = 0;
let failed = 0;
let cursor: string | undefined;
let total = 0;

while (true) {
  const result = await enrichUnlinkedBatch({
    userId: target.id,
    limit: 20,
    cursor,
  });
  if (total === 0) total = result.total;
  processed += result.processed;
  matched += result.matched;
  failed += result.failed;
  cursor = result.nextCursor ?? undefined;

  console.log(
    `  Fichas ${processed}/${total} · ${matched} vinculadas · ` +
      `${failed} errores · ${result.remaining} sin coincidencia/pendientes`,
  );

  if (result.done || result.processed === 0) break;
}

console.log(
  `Listo: ${matched} fichas copiadas${failed > 0 ? `, ${failed} errores` : ''}.`,
);
process.exit(0);
