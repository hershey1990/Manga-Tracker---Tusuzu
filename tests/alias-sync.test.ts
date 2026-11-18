import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/features/search/anilist', () => ({
  getAniListByIds: vi.fn(
    async (refs: { providerId: string; type: string }[]) => {
      const map = new Map();
      for (const ref of refs) {
        map.set(`${ref.type}:${ref.providerId}`, {
          provider: 'anilist',
          providerId: ref.providerId,
          type: 'manga',
          title: 'The 100 Girlfriends',
          titleRomaji: 'Kimi no Koto ga Daisuki na 100-nin no Kanojo',
          titleNative: null,
          synonyms: [
            'Mis 100 novias que me quieren mogollón mogollón',
            '100 Kanojo',
          ],
          description: null,
          coverImage: null,
          publicationStatus: 'RELEASING',
          year: 2019,
          totalUnits: null,
          genres: [],
        });
      }
      return map;
    },
  ),
  getAniListById: vi.fn(async () => null),
  searchAniList: vi.fn(async () => []),
  searchAniListBatch: vi.fn(async () => new Map()),
}));

const dir = mkdtempSync(join(tmpdir(), 'tsuzuku-alias-sync-'));
process.env.TURSO_DATABASE_URL = `file:${join(dir, 'test.db')}`;
delete process.env.TURSO_AUTH_TOKEN;

const { applyLocalMigrations } = await import('../scripts/local-migrate');
applyLocalMigrations(join(dir, 'test.db'), './drizzle');

const { db } = await import('../src/lib/db/client');
const { series, seriesAlias } = await import('../src/lib/db/schema');
const { syncAliasesBatch } = await import('../src/features/series/alias-sync');
const { searchLocalSeries } = await import('../src/features/series/queries');
const { eq } = await import('drizzle-orm');

const now = new Date();

beforeAll(async () => {
  await db.insert(series).values([
    {
      id: 'a1',
      type: 'manga',
      title: 'The 100 Girlfriends',
      normalizedTitle: 'the 100 girlfriends',
      provider: 'anilist',
      providerId: '114416',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'a2',
      type: 'manga',
      title: 'Berserk',
      normalizedTitle: 'berserk',
      provider: 'anilist',
      providerId: '30002',
      createdAt: now,
      updatedAt: now,
    },
  ]);
});

describe('alias sync', () => {
  it('backfills synonyms for linked series using a cursor', async () => {
    const first = await syncAliasesBatch({ limit: 1 });
    expect(first).toMatchObject({
      processed: 1,
      updated: 1,
      failed: 0,
      total: 2,
      done: false,
    });

    const second = await syncAliasesBatch({
      limit: 1,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second).toMatchObject({ processed: 1, updated: 1, done: false });

    const third = await syncAliasesBatch({
      limit: 1,
      cursor: second.nextCursor ?? undefined,
    });
    expect(third).toMatchObject({ processed: 0, done: true });

    const aliases = await db
      .select()
      .from(seriesAlias)
      .where(eq(seriesAlias.seriesId, 'a1'));
    expect(aliases.map((alias) => alias.alias)).toEqual(
      expect.arrayContaining([
        'Mis 100 novias que me quieren mogollón mogollón',
        '100 Kanojo',
      ]),
    );
  });

  it('makes localized synonyms searchable in the local database', async () => {
    const results = await searchLocalSeries('100 novias', 'all');
    expect(results.map((row) => row.id)).toContain('a1');
  });

  it('is idempotent', async () => {
    await syncAliasesBatch({ limit: 40 });
    const count = await db.select().from(seriesAlias);
    await syncAliasesBatch({ limit: 40 });
    const after = await db.select().from(seriesAlias);
    expect(after).toHaveLength(count.length);
  });
});

afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // SQLite mantiene archivos abiertos en Windows hasta cerrar el worker.
  }
});
