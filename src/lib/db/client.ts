import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

const rawUrl =
  process.env.TURSO_DATABASE_URL ??
  process.env.TURSO_DATABASE_URL_PROD ??
  'file:./local.db';

export const isRemoteDatabase = !rawUrl.startsWith('file:');

/**
 * Native modules are imported lazily: libSQL has no Windows ARM build, so a
 * local `file:` database must not load it, and Turso must not load better-sqlite3.
 */
const createDatabase = async () => {
  if (isRemoteDatabase) {
    const [{ createClient }, { drizzle }] = await Promise.all([
      import('@libsql/client/web'),
      import('drizzle-orm/libsql'),
    ]);
    const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_TOKEN;
    const client = createClient(
      authToken ? { url: rawUrl, authToken } : { url: rawUrl },
    );
    return drizzle(client, { schema });
  }

  const [{ DatabaseSync }, { drizzle }] = await Promise.all([
    import('node:sqlite'),
    import('drizzle-orm/sqlite-proxy'),
  ]);
  const file = rawUrl.replace(/^file:/, '') || './local.db';
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');

  return drizzle(
    async (query, params, method) => {
      const statement = sqlite.prepare(query);
      statement.setReturnArrays(true);
      if (method === 'run') {
        statement.run(...params);
        return { rows: [] };
      }
      const rows = statement.all(...params) as unknown as unknown[][];
      if (method === 'get') {
        return {
          rows: rows[0] ?? (null as unknown as unknown[]),
        };
      }
      return { rows };
    },
    { schema },
  );
};

// Both drivers expose the same SQLite builder at runtime; libSQL types cover both.
export const db = (await createDatabase()) as unknown as LibSQLDatabase<
  typeof schema
>;
export { schema };
