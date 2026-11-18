import { existsSync } from 'node:fs';
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

const email = argValue('email') ?? process.env.ENRICH_EMAIL;
const userIdArg = argValue('user');

const { db } = await import('../src/lib/db/client');
const { eq, asc } = await import('drizzle-orm');
const { user } = await import('../src/lib/db/schema');
const { enrichUnlinkedBatch, countPendingEnrichment } = await import(
  '../src/features/series/enrichment'
);

const selectUser = async () => {
  if (userIdArg) {
    const [row] = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, userIdArg))
      .limit(1);
    return row;
  }
  if (email) {
    const [row] = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    return row;
  }
  const [row] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .orderBy(asc(user.createdAt))
    .limit(1);
  return row;
};

const target = await selectUser();
if (!target) {
  console.error(
    'No hay usuario. Indica --email=... o --user=... o registra una cuenta.',
  );
  process.exit(1);
}

const total = await countPendingEnrichment(target.id);
console.log(`Usuario: ${target.email}`);
console.log(
  `${total} ${total === 1 ? 'serie pendiente' : 'series pendientes'} de ficha`,
);

let processed = 0;
let matched = 0;
let failed = 0;
let cursor: string | undefined;

while (true) {
  const result = await enrichUnlinkedBatch({
    userId: target.id,
    limit: 20,
    cursor,
  });
  processed += result.processed;
  matched += result.matched;
  failed += result.failed;
  cursor = result.nextCursor ?? undefined;

  console.log(
    `  ${processed}/${total} revisadas · ${matched} vinculadas · ` +
      `${failed} errores · ${result.remaining} sin coincidencia/pendientes`,
  );

  if (result.done || result.processed === 0) break;
}

console.log(
  `Listo: ${matched} fichas copiadas a la base${failed > 0 ? `, ${failed} errores` : ''}.`,
);
process.exit(0);
