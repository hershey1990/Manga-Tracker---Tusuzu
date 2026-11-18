import { readMigrationFiles } from './migrations';
import type { SqlValue } from './sync';

type RemoteExecutor = {
  execute: (
    statement: string | { sql: string; args: SqlValue[] },
  ) => Promise<{ rows: unknown[] }>;
};

/**
 * Applies the same `_migrations` journal used by the local database. A Turso
 * database created with `turso db create --from-file` already carries this
 * table, so future migrations are incremental instead of re-running 0000.
 */
export const applyRemoteMigrations = async (
  client: RemoteExecutor,
  folder = './drizzle',
) => {
  await client.execute(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
  );

  const result = await client.execute('SELECT name FROM _migrations');
  const applied = new Set(
    result.rows.map((row) => String((row as { name: unknown }).name)),
  );

  let count = 0;
  for (const migration of readMigrationFiles(folder)) {
    if (applied.has(migration.name)) continue;

    for (const statement of migration.statements) {
      await client.execute(statement);
    }

    await client.execute({
      sql: 'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)',
      args: [migration.name, Date.now()],
    });
    count += 1;
  }

  return count;
};
