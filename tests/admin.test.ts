import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'tsuzuku-admin-'));
process.env.TURSO_DATABASE_URL = `file:${join(dir, 'test.db')}`;
delete process.env.TURSO_AUTH_TOKEN;

const { applyLocalMigrations } = await import('../scripts/local-migrate');
applyLocalMigrations(join(dir, 'test.db'), './drizzle');

const { db } = await import('../src/lib/db/client');
const {
  importEntry,
  importJob,
  libraryEntry,
  series,
  seriesAlias,
  session,
  user,
} = await import('../src/lib/db/schema');
const {
  deleteUserAccount,
  findDuplicateGroups,
  getAdminStats,
  isAdmin,
  listAdminUsers,
  mergeSeriesGroup,
  revokeUserSessions,
  setUserDisabled,
} = await import('../src/features/admin/service');
const { eq } = await import('drizzle-orm');

const base = Math.floor(Date.now() / 1000);
const at = (offset: number) => new Date((base + offset) * 1000);

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: 'admin',
      name: 'Admin',
      email: 'admin@example.com',
      emailVerified: false,
      createdAt: at(0),
      updatedAt: at(0),
    },
    {
      id: 'friend',
      name: 'Friend',
      email: 'friend@example.com',
      emailVerified: false,
      createdAt: at(10),
      updatedAt: at(10),
    },
    {
      id: 'other',
      name: 'Other',
      email: 'other@example.com',
      emailVerified: false,
      createdAt: at(20),
      updatedAt: at(20),
    },
  ]);

  await db.insert(series).values([
    {
      id: 's-target',
      type: 'manga',
      title: 'Frieren',
      normalizedTitle: 'frieren',
      provider: 'anilist',
      providerId: '118586',
      coverImage: 'https://img/cover.jpg',
      createdAt: at(1),
      updatedAt: at(1),
    },
    {
      id: 's-source',
      type: 'manga',
      title: 'frieren',
      normalizedTitle: 'frieren',
      provider: null,
      providerId: null,
      createdAt: at(2),
      updatedAt: at(2),
    },
    {
      id: 's-alone',
      type: 'manga',
      title: 'Berserk',
      normalizedTitle: 'berserk',
      createdAt: at(3),
      updatedAt: at(3),
    },
  ]);

  await db.insert(seriesAlias).values({
    id: 'alias-1',
    seriesId: 's-source',
    alias: 'Sousou no Frieren',
    normalizedAlias: 'sousou no frieren',
  });

  await db.insert(libraryEntry).values([
    {
      id: 'e-admin-source',
      userId: 'admin',
      seriesId: 's-source',
      status: 'planning',
      progress: 10,
      notes: 'admin note',
      createdAt: at(4),
      updatedAt: at(4),
    },
    {
      id: 'e-friend-target',
      userId: 'friend',
      seriesId: 's-target',
      status: 'in_progress',
      progress: 2,
      notes: 'friend target',
      createdAt: at(5),
      updatedAt: at(5),
    },
    {
      id: 'e-friend-source',
      userId: 'friend',
      seriesId: 's-source',
      status: 'completed',
      progress: 8,
      score: 9,
      isFavorite: true,
      notes: 'friend source',
      createdAt: at(6),
      updatedAt: at(6),
    },
  ]);

  await db.insert(session).values({
    id: 'sess-friend',
    token: 'token-friend',
    userId: 'friend',
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: at(7),
    updatedAt: at(7),
  });

  await db.insert(importJob).values({
    id: 'job-1',
    userId: 'admin',
    source: 'obsidian',
    status: 'applied',
    total: 1,
    imported: 1,
    createdAt: at(8),
  });

  await db.insert(importEntry).values({
    id: 'ie-1',
    jobId: 'job-1',
    sourceFile: 'frieren.md',
    rawTitle: 'frieren',
    normalizedTitle: 'frieren',
    seriesId: 's-source',
    outcome: 'imported',
  });
});

describe('admin access', () => {
  it('treats the first registered user as admin', async () => {
    expect(await isAdmin('admin')).toBe(true);
    expect(await isAdmin('friend')).toBe(false);
    expect(await isAdmin('other')).toBe(false);
  });

  it('rejects privileged operations from non-admins', async () => {
    await expect(setUserDisabled('friend', 'other', true)).rejects.toThrow(
      'No autorizado',
    );
    await expect(
      mergeSeriesGroup('friend', 's-target', ['s-source']),
    ).rejects.toThrow('No autorizado');
  });
});

describe('duplicate management', () => {
  it('finds groups with identical normalized titles', async () => {
    const groups = await findDuplicateGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((item) => item.id).sort()).toEqual([
      's-source',
      's-target',
    ]);
  });

  it('merges sources into the target without losing user data', async () => {
    const result = await mergeSeriesGroup('admin', 's-target', ['s-source']);
    expect(result).toMatchObject({
      mergedSources: 1,
      movedEntries: 1,
      mergedEntries: 1,
    });

    const remaining = await db.select().from(series);
    expect(remaining.map((row) => row.id).sort()).toEqual([
      's-alone',
      's-target',
    ]);

    const adminEntry = await db
      .select()
      .from(libraryEntry)
      .where(eq(libraryEntry.userId, 'admin'));
    expect(adminEntry).toHaveLength(1);
    expect(adminEntry[0]).toMatchObject({
      seriesId: 's-target',
      progress: 10,
      notes: 'admin note',
    });

    const friendEntry = await db
      .select()
      .from(libraryEntry)
      .where(eq(libraryEntry.userId, 'friend'));
    expect(friendEntry).toHaveLength(1);
    expect(friendEntry[0]).toMatchObject({
      seriesId: 's-target',
      status: 'completed',
      progress: 8,
      score: 9,
      isFavorite: true,
    });
    expect(friendEntry[0]?.notes).toContain('friend target');
    expect(friendEntry[0]?.notes).toContain('friend source');

    const aliases = await db
      .select()
      .from(seriesAlias)
      .where(eq(seriesAlias.seriesId, 's-target'));
    expect(aliases.map((alias) => alias.alias)).toContain('Sousou no Frieren');

    const entry = await db
      .select()
      .from(importEntry)
      .where(eq(importEntry.id, 'ie-1'));
    expect(entry[0]?.seriesId).toBe('s-target');
  });
});

describe('user management', () => {
  it('disables an account, revokes its sessions and blocks self-disable', async () => {
    await setUserDisabled('admin', 'friend', true);

    const [friend] = await db.select().from(user).where(eq(user.id, 'friend'));
    expect(friend?.disabled).toBe(true);

    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, 'friend'));
    expect(sessions).toHaveLength(0);

    await expect(setUserDisabled('admin', 'admin', true)).rejects.toThrow(
      'propia cuenta',
    );
  });

  it('lists users with entry and session counts', async () => {
    await db.insert(session).values({
      id: 'sess-other',
      token: 'token-other',
      userId: 'other',
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: at(9),
      updatedAt: at(9),
    });

    const users = await listAdminUsers('admin');
    expect(users.map((row) => row.id)).toEqual(['admin', 'friend', 'other']);
    expect(users.find((row) => row.id === 'admin')).toMatchObject({
      isAdmin: true,
      entries: 1,
    });
    expect(users.find((row) => row.id === 'friend')).toMatchObject({
      disabled: true,
      entries: 1,
    });

    await revokeUserSessions('admin', 'other');
    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, 'other'));
    expect(sessions).toHaveLength(0);
  });

  it('deletes accounts in cascade but never the acting admin', async () => {
    await deleteUserAccount('admin', 'other');
    const users = await db.select().from(user);
    expect(users.map((row) => row.id).sort()).toEqual(['admin', 'friend']);

    await expect(deleteUserAccount('admin', 'admin')).rejects.toThrow(
      'propia cuenta',
    );
  });
});

describe('global stats', () => {
  it('aggregates users, series, entries and statuses', async () => {
    const stats = await getAdminStats();
    expect(stats.users).toBe(2);
    expect(stats.disabledUsers).toBe(1);
    expect(stats.series).toBe(2);
    expect(stats.entries).toBe(2);
    expect(stats.favorites).toBe(1);
    expect(stats.units).toBe(18);
    expect(stats.byStatus.completed).toBe(1);
    expect(stats.byStatus.planning).toBe(1);
  });
});

afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // SQLite mantiene el archivo abierto hasta que termina el worker.
  }
});
