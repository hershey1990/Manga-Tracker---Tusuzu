import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/features/search/anilist', () => ({
  searchAniList: vi.fn(async () => []),
  searchAniListBatch: vi.fn(
    async (queries: { key: string; title: string; type: string }[]) => {
      const results = new Map();
      for (const query of queries) {
        if (query.title === 'Unknown') {
          results.set(query.key, []);
          continue;
        }
        results.set(query.key, [
          {
            provider: 'anilist',
            providerId:
              query.title === 'Frieren'
                ? '1'
                : query.title === 'Berserk'
                  ? '2'
                  : '3',
            type: 'manga',
            title: query.title,
            titleRomaji: `${query.title} Romaji`,
            titleNative: null,
            synonyms: [],
            description: `Sinopsis de ${query.title}`,
            coverImage: `https://img/${query.title}.jpg`,
            publicationStatus: 'FINISHED',
            year: 2020,
            totalUnits: 10,
            genres: ['Fantasy'],
          },
        ]);
      }
      return results;
    },
  ),
  getAniListById: vi.fn(async () => null),
}));

const dir = mkdtempSync(join(tmpdir(), 'tsuzuku-enrich-'));
process.env.TURSO_DATABASE_URL = `file:${join(dir, 'test.db')}`;
delete process.env.TURSO_AUTH_TOKEN;

const { applyLocalMigrations } = await import('../scripts/local-migrate');
applyLocalMigrations(join(dir, 'test.db'), './drizzle');

const { db } = await import('../src/lib/db/client');
const { libraryEntry, series, seriesAlias, user } = await import(
  '../src/lib/db/schema'
);
const { countPendingEnrichment, enrichUnlinkedBatch } = await import(
  '../src/features/series/enrichment'
);
const { eq } = await import('drizzle-orm');

const now = new Date();

const seed = async (values: {
  id: string;
  title: string;
  normalizedTitle: string;
}) => {
  await db.insert(series).values({
    ...values,
    type: 'manga',
    provider: null,
    providerId: null,
    createdAt: now,
    updatedAt: now,
  });
};

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: 'user-a',
      name: 'A',
      email: 'a@example.com',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-b',
      name: 'B',
      email: 'b@example.com',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await seed({ id: 'a1', title: 'Frieren', normalizedTitle: 'frieren' });
  await seed({ id: 'a2', title: 'Berserk', normalizedTitle: 'berserk' });
  await seed({ id: 'b1', title: 'Monster', normalizedTitle: 'monster' });
  await seed({ id: 'a3', title: 'Unknown', normalizedTitle: 'unknown' });

  await db.insert(libraryEntry).values([
    {
      id: 'e1',
      userId: 'user-a',
      seriesId: 'a1',
      status: 'planning',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'e2',
      userId: 'user-a',
      seriesId: 'a2',
      status: 'planning',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'e3',
      userId: 'user-a',
      seriesId: 'a3',
      status: 'planning',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'e4',
      userId: 'user-b',
      seriesId: 'b1',
      status: 'planning',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]);
});

describe('library enrichment', () => {
  it('counts only unlinked series in the requested library', async () => {
    expect(await countPendingEnrichment('user-a')).toBe(3);
    expect(await countPendingEnrichment('user-b')).toBe(1);
    expect(await countPendingEnrichment()).toBe(4);
  });

  it('processes the user library with a cursor and copies metadata', async () => {
    const first = await enrichUnlinkedBatch({ userId: 'user-a', limit: 2 });
    expect(first).toMatchObject({
      processed: 2,
      matched: 2,
      failed: 0,
      total: 3,
      done: false,
    });
    expect(first.nextCursor).toBeTruthy();

    const second = await enrichUnlinkedBatch({
      userId: 'user-a',
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second).toMatchObject({
      processed: 1,
      matched: 0,
      total: 1,
      done: true,
    });
    expect(second.remaining).toBe(1);

    const frieren = await db.select().from(series).where(eq(series.id, 'a1'));
    expect(frieren[0]).toMatchObject({
      provider: 'anilist',
      providerId: '1',
      coverImage: 'https://img/Frieren.jpg',
      sourceUrl: 'https://anilist.co/manga/1',
    });

    const aliases = await db
      .select()
      .from(seriesAlias)
      .where(eq(seriesAlias.seriesId, 'a1'));
    expect(aliases.map((alias) => alias.alias)).toContain('Frieren Romaji');

    const monster = await db.select().from(series).where(eq(series.id, 'b1'));
    expect(monster[0]?.provider).toBeNull();
  });

  it('lets an admin sweep the rest of the instance', async () => {
    const result = await enrichUnlinkedBatch({ limit: 20 });
    expect(result.processed).toBe(2);
    expect(result.matched).toBe(1);
    expect(result.remaining).toBe(1);

    const monster = await db.select().from(series).where(eq(series.id, 'b1'));
    expect(monster[0]?.coverImage).toBe('https://img/Monster.jpg');
  });
});

afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // SQLite mantiene archivos abiertos en Windows hasta cerrar el worker.
  }
});
