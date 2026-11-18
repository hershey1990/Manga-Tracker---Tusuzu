import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'tsuzuku-test-'));
process.env.TURSO_DATABASE_URL = `file:${join(dir, 'test.db')}`;
delete process.env.TURSO_AUTH_TOKEN;

const { applyLocalMigrations } = await import('../scripts/local-migrate');

applyLocalMigrations(join(dir, 'test.db'), './drizzle');

const { db } = await import('../src/lib/db/client');
const { libraryEntry, series, user } = await import('../src/lib/db/schema');
const { applyImport, createPreview } = await import(
  '../src/features/import/importer'
);
const { getEntryById, getLibraryStats, listLibrary } = await import(
  '../src/features/library/queries'
);
const { getSeriesById } = await import('../src/features/series/queries');
const { libraryFilterSchema } = await import('../src/features/library/schema');
const { eq } = await import('drizzle-orm');

const now = new Date();

const seedUser = async (id: string, email: string) => {
  await db.insert(user).values({
    id,
    name: id,
    email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
};

const records = [
  {
    file: 'Frieren.md',
    title: 'Frieren',
    type: 'manga' as const,
    chapter: 0,
    status: 'planning' as const,
    url: 'https://example.com/frieren',
    image: null,
    notes: null,
    warnings: [],
  },
  {
    file: 'Frieren copy.md',
    title: 'frieren',
    type: 'manga' as const,
    chapter: 3,
    status: 'in_progress' as const,
    url: null,
    image: null,
    notes: null,
    warnings: [],
  },
  {
    file: 'Berserk.md',
    title: 'Berserk',
    type: 'manga' as const,
    chapter: 364,
    status: 'completed' as const,
    url: null,
    image: null,
    notes: 'Obra maestra',
    warnings: [],
  },
  {
    file: 'Jujutsu Kaisen.md',
    title: 'Jujutsu Kaisen',
    type: 'manga' as const,
    chapter: 100,
    status: 'in_progress' as const,
    url: null,
    image: 'not-a-url',
    notes: null,
    warnings: [],
  },
];

describe('vault import', () => {
  it('previews duplicates and existing entries without writing library data', async () => {
    await seedUser('user-a', 'a@example.com');

    const preview = await createPreview('user-a', records);
    expect(preview.total).toBe(4);
    expect(preview.newCount).toBe(3);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.existingCount).toBe(0);

    const library = await db.select().from(libraryEntry);
    expect(library).toHaveLength(0);
  });

  it('applies the import with progress, status and notes', async () => {
    const preview = await createPreview('user-a', records);
    const report = await applyImport('user-a', preview.jobId);

    expect(report).toMatchObject({
      total: 4,
      imported: 3,
      skipped: 1,
      failed: 0,
    });

    const stats = await getLibraryStats('user-a');
    expect(stats.total).toBe(3);
    expect(stats.byStatus.completed).toBe(1);
    expect(stats.byStatus.in_progress).toBe(1);
    expect(stats.byStatus.planning).toBe(1);
    expect(stats.byType.manga).toBe(3);

    const filters = libraryFilterSchema.parse({});
    const page = await listLibrary('user-a', filters);
    const berserk = page.items.find((item) => item.title === 'Berserk');
    expect(berserk).toMatchObject({
      progress: 364,
      status: 'completed',
      notes: 'Obra maestra',
    });

    const jujutsu = page.items.find((item) => item.title === 'Jujutsu Kaisen');
    expect(jujutsu?.coverImage).toBeNull();
  });

  it('is idempotent and rejects replaying the same job', async () => {
    const preview = await createPreview('user-a', records);
    expect(preview.existingCount).toBe(4);
    expect(preview.newCount).toBe(0);

    const report = await applyImport('user-a', preview.jobId);
    expect(report.imported).toBe(0);

    await expect(applyImport('user-a', preview.jobId)).rejects.toThrow(
      'ya fue procesada',
    );

    const rows = await db.select().from(series);
    expect(rows).toHaveLength(3);
  });

  it('keeps each user isolated', async () => {
    await seedUser('user-b', 'b@example.com');
    const [seriesA] = await db.select().from(series).limit(1);
    const [entryA] = await db
      .select()
      .from(libraryEntry)
      .where(eq(libraryEntry.userId, 'user-a'))
      .limit(1);

    expect(entryA).toBeDefined();
    const item = await getSeriesById(seriesA!.id);
    expect(item).not.toBeNull();

    expect(await getEntryById('user-b', entryA!.id)).toBeNull();

    await db.insert(libraryEntry).values({
      id: crypto.randomUUID(),
      userId: 'user-b',
      seriesId: seriesA!.id,
      status: 'dropped',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    });

    expect((await getLibraryStats('user-b')).total).toBe(1);
    expect((await getLibraryStats('user-a')).total).toBe(3);
  });
});

afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows keeps the SQLite file open until the worker exits.
  }
});
