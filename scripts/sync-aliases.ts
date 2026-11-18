import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const { syncAliasesBatch } = await import('../src/features/series/alias-sync');

let processed = 0;
let updated = 0;
let failed = 0;
let cursor: string | undefined;
let total = 0;

while (true) {
  const result = await syncAliasesBatch({ limit: 40, cursor });
  if (total === 0) total = result.total;
  processed += result.processed;
  updated += result.updated;
  failed += result.failed;
  cursor = result.nextCursor ?? undefined;

  console.log(
    `  ${processed}/${total} fichas · ${updated} con alias sincronizados` +
      `${failed > 0 ? ` · ${failed} errores` : ''}`,
  );

  if (result.done || result.processed === 0) break;
}

console.log('Listo. La busqueda local ya incluye sinonimos de AniList.');
process.exit(0);
