import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';
import { applyLocalMigrations } from '../scripts/local-migrate';
import { applyRemoteMigrations } from '../scripts/remote-migrate';
import type { SqlValue } from '../scripts/sync';

const dir = mkdtempSync(join(tmpdir(), 'tsuzuku-remote-migrations-'));

const executorFor = (file: string) => {
  const sqlite = new DatabaseSync(file);
  return {
    sqlite,
    execute: async (statement: string | { sql: string; args: SqlValue[] }) => {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      const args = typeof statement === 'string' ? [] : statement.args;
      const prepared = sqlite.prepare(sql);
      if (/^\s*(select|pragma)/i.test(sql)) {
        return { rows: prepared.all(...args) as unknown[] };
      }
      prepared.run(...args);
      return { rows: [] };
    },
  };
};

describe('remote migrations', () => {
  it('applies the journal and is idempotent', async () => {
    const file = join(dir, 'empty.db');
    const { sqlite, execute } = executorFor(file);

    expect(await applyRemoteMigrations({ execute })).toBe(2);
    expect(await applyRemoteMigrations({ execute })).toBe(0);

    const columns = (
      sqlite.prepare('PRAGMA table_info("user")').all() as { name: string }[]
    ).map((column) => column.name);
    expect(columns).toContain('disabled');

    const journal = sqlite
      .prepare('SELECT name FROM _migrations ORDER BY name')
      .all() as { name: string }[];
    expect(journal.map((row) => row.name)).toEqual([
      '0000_salty_justice.sql',
      '0001_add_user_disabled.sql',
    ]);
    sqlite.close();
  });

  it('detects an already migrated database copied from local.db', async () => {
    const file = join(dir, 'from-file.db');
    applyLocalMigrations(file);

    const { sqlite, execute } = executorFor(file);
    expect(await applyRemoteMigrations({ execute })).toBe(0);
    sqlite.close();
  });
});

afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // SQLite puede mantener archivos abiertos en Windows hasta cerrar el worker.
  }
});
