import { DatabaseSync } from 'node:sqlite';
import { readMigrationFiles } from './migrations';

/**
 * Applies drizzle SQL migrations to a local SQLite file without native modules.
 * Turso migrations use the same journal through remote-migrate.
 */
export const applyLocalMigrations = (
  file: string,
  migrationsFolder = './drizzle',
) => {
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);',
  );

  const applied = new Set(
    (
      sqlite.prepare('SELECT name FROM _migrations').all() as {
        name: string;
      }[]
    ).map((row) => row.name),
  );

  for (const migration of readMigrationFiles(migrationsFolder)) {
    if (applied.has(migration.name)) continue;
    for (const statement of migration.statements) {
      sqlite.exec(statement);
    }
    sqlite
      .prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
      .run(migration.name, Date.now());
  }

  sqlite.close();
};
