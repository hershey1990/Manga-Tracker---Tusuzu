import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProviderSeries } from '../src/features/search/types';

const dir = mkdtempSync(join(tmpdir(), 'tsuzuku-search-add-'));
process.env.TURSO_DATABASE_URL = `file:${join(dir, 'test.db')}`;
delete process.env.TURSO_AUTH_TOKEN;

const { applyLocalMigrations } = await import('../scripts/local-migrate');
applyLocalMigrations(join(dir, 'test.db'), './drizzle');

const { db } = await import('../src/lib/db/client');
const { libraryEntry, series, seriesAlias, user } = await import(
  '../src/lib/db/schema'
);
const { findOrCreateProviderSeries } = await import(
  '../src/features/series/queries'
);
const { addProviderMediaToLibrary } = await import(
  '../src/features/search/library'
);
const { eq } = await import('drizzle-orm');

const now = new Date();

const media = (overrides: Partial<ProviderSeries> = {}): ProviderSeries => ({
  provider: 'anilist',
  providerId: '118586',
  type: 'manga',
  title: "Frieren: Beyond Journey's End",
  titleRomaji: 'Sousou no Frieren',
  titleNative: null,
  synonyms: ['Frieren'],
  description: 'Sinopsis',
  coverImage: 'https://img/frieren.jpg',
  publicationStatus: 'RELEASING',
  year: 2020,
  totalUnits: null,
  genres: ['Fantasy'],
  ...overrides,
});

beforeAll(async () => {
  await db.insert(user).values({
    id: 'user-a',
    name: 'A',
    email: 'a@example.com',
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(series).values({
    id: 'local-frieren',
    type: 'manga',
    title: 'Frieren',
    normalizedTitle: 'frieren',
    provider: null,
    providerId: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(seriesAlias).values({
    id: 'alias-1',
    seriesId: 'local-frieren',
    alias: 'Sousou no Frieren',
    normalizedAlias: 'sousou no frieren',
  });

  await db.insert(libraryEntry).values({
    id: 'entry-1',
    userId: 'user-a',
    seriesId: 'local-frieren',
    status: 'in_progress',
    progress: 12,
    createdAt: now,
    updatedAt: now,
  });
});

describe('adding a provider result to the library', () => {
  it('enriches a matching unlinked vault series instead of duplicating it', async () => {
    const result = await findOrCreateProviderSeries(media());

    expect(result).toMatchObject({
      linkedExisting: true,
      createdSeries: false,
    });
    expect(result.series.id).toBe('local-frieren');

    const [row] = await db
      .select()
      .from(series)
      .where(eq(series.id, 'local-frieren'));
    expect(row).toMatchObject({
      title: 'Frieren',
      provider: 'anilist',
      providerId: '118586',
      coverImage: 'https://img/frieren.jpg',
      sourceUrl: 'https://anilist.co/manga/118586',
    });

    const aliases = await db
      .select()
      .from(seriesAlias)
      .where(eq(seriesAlias.seriesId, 'local-frieren'));
    expect(aliases.map((alias) => alias.alias)).toEqual(
      expect.arrayContaining([
        "Frieren: Beyond Journey's End",
        'Sousou no Frieren',
      ]),
    );
  });

  it('keeps the existing entry and progress when adding the same result', async () => {
    const result = await addProviderMediaToLibrary('user-a', media());
    expect(result.createdEntry).toBe(false);
    expect(result.seriesId).toBe('local-frieren');

    const entries = await db
      .select()
      .from(libraryEntry)
      .where(eq(libraryEntry.userId, 'user-a'));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ progress: 12, status: 'in_progress' });
  });

  it('creates a local series and entry for a new result', async () => {
    const berserk = media({
      providerId: '30002',
      title: 'Berserk',
      titleRomaji: 'Berserk',
      synonyms: [],
      coverImage: 'https://img/berserk.jpg',
    });
    const result = await addProviderMediaToLibrary('user-a', berserk);

    expect(result).toMatchObject({
      createdSeries: true,
      createdEntry: true,
    });

    const [row] = await db
      .select()
      .from(series)
      .where(eq(series.id, result.seriesId));
    expect(row?.provider).toBe('anilist');
    expect(row?.coverImage).toBe('https://img/berserk.jpg');
  });

  it('reuses the provider record when the title differs', async () => {
    const renamed = media({ title: 'Frieren (edición especial)' });
    const result = await findOrCreateProviderSeries(renamed);
    expect(result.createdSeries).toBe(false);
    expect(result.series.id).toBe('local-frieren');
  });
});

afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // SQLite mantiene archivos abiertos en Windows hasta cerrar el worker.
  }
});
