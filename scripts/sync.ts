import { DatabaseSync } from 'node:sqlite';

export type SqlValue = string | number | null | Uint8Array;
export type BatchStatement = { sql: string; args: SqlValue[] };

/**
 * Parents before children so foreign keys stay valid during a copy.
 */
export const TABLE_ORDER = [
  'user',
  'series',
  'series_alias',
  'library_entry',
  'session',
  'account',
  'verification',
  'import_job',
  'import_entry',
  'provider_cache',
] as const;

export type TableName = (typeof TABLE_ORDER)[number];

export type TableSnapshot = {
  table: TableName;
  columns: string[];
  rows: Record<string, SqlValue>[];
};

export const readLocalSnapshot = (file: string): TableSnapshot[] => {
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys = ON;');

  const existing = new Set(
    (
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        )
        .all() as { name: string }[]
    ).map((row) => row.name),
  );

  const snapshot: TableSnapshot[] = [];

  for (const table of TABLE_ORDER) {
    if (!existing.has(table)) continue;

    const columns = (
      sqlite.prepare(`PRAGMA table_info("${table}")`).all() as {
        name: string;
      }[]
    ).map((column) => column.name);

    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<
      string,
      SqlValue
    >[];

    snapshot.push({ table, columns, rows });
  }

  sqlite.close();
  return snapshot;
};

export const buildInsertStatements = (
  snapshot: TableSnapshot,
): BatchStatement[] => {
  const columnList = snapshot.columns.map((column) => `"${column}"`).join(', ');
  const placeholders = snapshot.columns.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO "${snapshot.table}" (${columnList}) VALUES (${placeholders})`;

  return snapshot.rows.map((row) => ({
    sql,
    args: snapshot.columns.map((column) => row[column] ?? null),
  }));
};

export const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
};

export type BatchExecutor = (statements: BatchStatement[]) => Promise<void>;

export const copySnapshot = async (
  snapshot: TableSnapshot[],
  execute: BatchExecutor,
  onProgress?: (table: TableName, rows: number) => void,
) => {
  for (const table of snapshot) {
    const statements = buildInsertStatements(table);
    if (statements.length === 0) {
      onProgress?.(table.table, 0);
      continue;
    }
    for (const batch of chunk(statements, 75)) {
      await execute(batch);
    }
    onProgress?.(table.table, statements.length);
  }
};
