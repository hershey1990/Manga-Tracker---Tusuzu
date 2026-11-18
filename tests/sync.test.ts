import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';
import { applyLocalMigrations } from '../scripts/local-migrate';
import {
  type BatchStatement,
  copySnapshot,
  readLocalSnapshot,
} from '../scripts/sync';

const dir = mkdtempSync(join(tmpdir(), 'tsuzuku-sync-'));
const sourceFile = join(dir, 'source.db');
const targetFile = join(dir, 'target.db');

const now = Math.floor(Date.now() / 1000);

applyLocalMigrations(sourceFile);
applyLocalMigrations(targetFile);

const source = new DatabaseSync(sourceFile);
source.exec('PRAGMA foreign_keys = ON;');
source
  .prepare(
    'INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  .run('u1', 'Hershey', 'h@example.com', 0, null, now, now);
source
  .prepare(
    'INSERT INTO series (id, type, title, normalized_title, title_romaji, title_native, description, cover_image, publication_status, year, total_units, genres, source_url, provider, provider_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  .run(
    's1',
    'manga',
    'Frieren',
    'frieren',
    null,
    null,
    null,
    null,
    'RELEASING',
    2020,
    null,
    JSON.stringify(['Fantasy']),
    null,
    'anilist',
    '118586',
    now,
    now,
  );
source
  .prepare(
    'INSERT INTO library_entry (id, user_id, series_id, status, progress, total_units_override, score, is_favorite, notes, started_at, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  .run(
    'e1',
    'u1',
    's1',
    'in_progress',
    12,
    null,
    9,
    1,
    'buena',
    null,
    null,
    now,
    now,
  );
source.close();

describe('sync snapshot', () => {
  it('reads tables in foreign-key order and skips empty ones', () => {
    const snapshot = readLocalSnapshot(sourceFile);
    const tables = snapshot.map((table) => table.table);

    expect(tables).toEqual([
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
    ]);
    expect(tables.indexOf('user')).toBeLessThan(tables.indexOf('series'));
    expect(tables.indexOf('series')).toBeLessThan(
      tables.indexOf('library_entry'),
    );
    expect(snapshot.find((t) => t.table === 'series')?.rows[0]).toMatchObject({
      id: 's1',
      provider: 'anilist',
      genres: JSON.stringify(['Fantasy']),
    });
  });

  it('copies every row into another database with foreign keys enabled', async () => {
    const snapshot = readLocalSnapshot(sourceFile);
    const target = new DatabaseSync(targetFile);
    target.exec('PRAGMA foreign_keys = ON;');

    const execute = async (statements: BatchStatement[]) => {
      for (const statement of statements) {
        target.prepare(statement.sql).run(...statement.args);
      }
    };

    const progress: string[] = [];
    await copySnapshot(snapshot, execute, (table, rows) => {
      progress.push(`${table}:${rows}`);
    });
    target.close();

    const verify = new DatabaseSync(targetFile);
    const entries = verify
      .prepare(
        'SELECT e.progress, e.score, u.email, s.title FROM library_entry e JOIN user u ON u.id = e.user_id JOIN series s ON s.id = e.series_id',
      )
      .all() as Record<string, unknown>[];
    verify.close();

    expect(progress).toEqual([
      'user:1',
      'series:1',
      'series_alias:0',
      'library_entry:1',
      'session:0',
      'account:0',
      'verification:0',
      'import_job:0',
      'import_entry:0',
      'provider_cache:0',
    ]);
    expect(entries).toEqual([
      { progress: 12, score: 9, email: 'h@example.com', title: 'Frieren' },
    ]);
  });

  it('can copy twice without duplicating rows', async () => {
    const snapshot = readLocalSnapshot(sourceFile);
    const target = new DatabaseSync(targetFile);
    const execute = async (statements: BatchStatement[]) => {
      for (const statement of statements) {
        target.prepare(statement.sql).run(...statement.args);
      }
    };
    await copySnapshot(snapshot, execute);

    const count = (
      target.prepare('SELECT COUNT(*) AS n FROM library_entry').get() as {
        n: number;
      }
    ).n;
    target.close();
    expect(count).toBe(1);
  });
});

afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // SQLite puede mantener el archivo abierto en Windows hasta cerrar el worker.
  }
});
