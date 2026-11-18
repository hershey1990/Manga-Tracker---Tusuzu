import { and, asc, count, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../lib/db/client';
import {
  importEntry,
  importJob,
  libraryEntry,
  series,
  seriesAlias,
  session,
  user,
} from '../../lib/db/schema';
import { getAniListById } from '../search/anilist';
import { enrichUnlinkedBatch } from '../series/enrichment';
import type { LibraryStatus } from '../series/schema';

export class AdminForbiddenError extends Error {
  constructor() {
    super('No autorizado');
    this.name = 'AdminForbiddenError';
  }
}

export const getAdminUserId = async (): Promise<string | null> => {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .orderBy(asc(user.createdAt), sql`rowid asc`)
    .limit(1);
  return row?.id ?? null;
};

export const isAdmin = async (userId: string) => {
  const adminId = await getAdminUserId();
  return adminId !== null && adminId === userId;
};

const assertAdmin = async (userId: string) => {
  if (!(await isAdmin(userId))) {
    throw new AdminForbiddenError();
  }
};

export type AdminStats = {
  users: number;
  disabledUsers: number;
  series: number;
  missingCovers: number;
  unlinked: number;
  entries: number;
  favorites: number;
  units: number;
  activeSessions: number;
  imports: number;
  byStatus: Record<LibraryStatus, number>;
};

export const getAdminStats = async (): Promise<AdminStats> => {
  const [userRow] = await db
    .select({
      total: count(),
      disabled: sql<number>`coalesce(sum(case when ${user.disabled} then 1 else 0 end), 0)`,
    })
    .from(user);

  const [seriesRow] = await db
    .select({
      total: count(),
      missingCovers: sql<number>`coalesce(sum(case when ${series.coverImage} is null then 1 else 0 end), 0)`,
      unlinked: sql<number>`coalesce(sum(case when ${series.provider} is null then 1 else 0 end), 0)`,
    })
    .from(series);

  const [entryRow] = await db
    .select({
      total: count(),
      favorites: sql<number>`coalesce(sum(case when ${libraryEntry.isFavorite} then 1 else 0 end), 0)`,
      units: sql<number>`coalesce(sum(${libraryEntry.progress}), 0)`,
    })
    .from(libraryEntry);

  const [sessionRow] = await db
    .select({ total: count() })
    .from(session)
    .where(gt(session.expiresAt, new Date()));

  const [importRow] = await db.select({ total: count() }).from(importJob);

  const statusRows = await db
    .select({ status: libraryEntry.status, value: count() })
    .from(libraryEntry)
    .groupBy(libraryEntry.status);

  const byStatus = {
    planning: 0,
    in_progress: 0,
    completed: 0,
    paused: 0,
    dropped: 0,
  } satisfies Record<LibraryStatus, number>;
  for (const row of statusRows) {
    byStatus[row.status] = row.value;
  }

  return {
    users: userRow?.total ?? 0,
    disabledUsers: Number(userRow?.disabled ?? 0),
    series: seriesRow?.total ?? 0,
    missingCovers: Number(seriesRow?.missingCovers ?? 0),
    unlinked: Number(seriesRow?.unlinked ?? 0),
    entries: entryRow?.total ?? 0,
    favorites: Number(entryRow?.favorites ?? 0),
    units: Number(entryRow?.units ?? 0),
    activeSessions: sessionRow?.total ?? 0,
    imports: importRow?.total ?? 0,
    byStatus,
  };
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  disabled: boolean;
  entries: number;
  sessions: number;
  isCurrent: boolean;
  isAdmin: boolean;
};

export const listAdminUsers = async (actorId: string) => {
  await assertAdmin(actorId);
  const adminId = await getAdminUserId();

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      disabled: user.disabled,
    })
    .from(user)
    .orderBy(asc(user.createdAt), sql`rowid asc`);

  const entryCounts = await db
    .select({ userId: libraryEntry.userId, value: count() })
    .from(libraryEntry)
    .groupBy(libraryEntry.userId);

  const sessionCounts = await db
    .select({ userId: session.userId, value: count() })
    .from(session)
    .where(gt(session.expiresAt, new Date()))
    .groupBy(session.userId);

  const entryMap = new Map(entryCounts.map((row) => [row.userId, row.value]));
  const sessionMap = new Map(
    sessionCounts.map((row) => [row.userId, row.value]),
  );

  return users.map<AdminUser>((row) => ({
    ...row,
    entries: entryMap.get(row.id) ?? 0,
    sessions: sessionMap.get(row.id) ?? 0,
    isCurrent: row.id === actorId,
    isAdmin: row.id === adminId,
  }));
};

export type DuplicateItem = {
  id: string;
  title: string;
  year: number | null;
  coverImage: string | null;
  provider: string | null;
  entries: number;
};

export type DuplicateGroup = {
  key: string;
  type: 'manga' | 'anime';
  title: string;
  items: DuplicateItem[];
};

export const findDuplicateGroups = async (limit = 40) => {
  const groups = await db
    .select({
      type: series.type,
      normalizedTitle: series.normalizedTitle,
      value: count(),
    })
    .from(series)
    .groupBy(series.type, series.normalizedTitle)
    .having(gt(count(), 1))
    .limit(limit);

  if (groups.length === 0) return [] as DuplicateGroup[];

  const normalizedTitles = groups.map((group) => group.normalizedTitle);
  const rows = await db
    .select({
      id: series.id,
      type: series.type,
      title: series.title,
      normalizedTitle: series.normalizedTitle,
      year: series.year,
      coverImage: series.coverImage,
      provider: series.provider,
    })
    .from(series)
    .where(inArray(series.normalizedTitle, normalizedTitles))
    .orderBy(asc(series.title));

  const entryCounts = await db
    .select({ seriesId: libraryEntry.seriesId, value: count() })
    .from(libraryEntry)
    .where(
      inArray(
        libraryEntry.seriesId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(libraryEntry.seriesId);
  const entryMap = new Map(entryCounts.map((row) => [row.seriesId, row.value]));

  const grouped = new Map<string, DuplicateGroup>();
  for (const row of rows) {
    const key = `${row.type}:${row.normalizedTitle}`;
    let group = grouped.get(key);
    if (!group) {
      group = { key, type: row.type, title: row.title, items: [] };
      grouped.set(key, group);
    }
    group.items.push({
      id: row.id,
      title: row.title,
      year: row.year,
      coverImage: row.coverImage,
      provider: row.provider,
      entries: entryMap.get(row.id) ?? 0,
    });
  }

  return [...grouped.values()].filter((group) => group.items.length > 1);
};

const STATUS_RANK: Record<LibraryStatus, number> = {
  dropped: 0,
  planning: 1,
  paused: 2,
  in_progress: 3,
  completed: 4,
};

const mergeNotes = (
  first: string | null,
  second: string | null,
): string | null => {
  const parts = [first, second]
    .flatMap((value) => (value ? value.split('\n\n') : []))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join('\n\n') : null;
};

const earliest = (first: Date | null, second: Date | null) => {
  if (!first) return second;
  if (!second) return first;
  return first.getTime() <= second.getTime() ? first : second;
};

const latest = (first: Date | null, second: Date | null) => {
  if (!first) return second;
  if (!second) return first;
  return first.getTime() >= second.getTime() ? first : second;
};

export const mergeSeriesGroup = async (
  actorId: string,
  targetId: string,
  sourceIds: string[],
) => {
  await assertAdmin(actorId);

  const sources = [...new Set(sourceIds)].filter((id) => id !== targetId);
  if (sources.length === 0) {
    throw new Error('Selecciona al menos una serie duplicada');
  }

  const rows = await db
    .select()
    .from(series)
    .where(inArray(series.id, [targetId, ...sources]));

  const target = rows.find((row) => row.id === targetId);
  if (!target) throw new Error('La serie destino no existe');

  const sourceRows = rows.filter((row) => sources.includes(row.id));
  if (sourceRows.length !== sources.length) {
    throw new Error('Alguna serie de origen ya no existe');
  }
  for (const row of sourceRows) {
    if (
      row.normalizedTitle !== target.normalizedTitle ||
      row.type !== target.type
    ) {
      throw new Error('Solo se pueden fusionar series equivalentes');
    }
  }

  let movedEntries = 0;
  let mergedEntries = 0;

  await db.transaction(async (tx) => {
    for (const source of sourceRows) {
      const entries = await tx
        .select()
        .from(libraryEntry)
        .where(eq(libraryEntry.seriesId, source.id));

      for (const entry of entries) {
        const [existing] = await tx
          .select()
          .from(libraryEntry)
          .where(
            and(
              eq(libraryEntry.userId, entry.userId),
              eq(libraryEntry.seriesId, targetId),
            ),
          )
          .limit(1);

        if (!existing) {
          await tx
            .update(libraryEntry)
            .set({ seriesId: targetId, updatedAt: new Date() })
            .where(eq(libraryEntry.id, entry.id));
          movedEntries += 1;
          continue;
        }

        const status =
          STATUS_RANK[entry.status] > STATUS_RANK[existing.status]
            ? entry.status
            : existing.status;

        await tx
          .update(libraryEntry)
          .set({
            status,
            progress: Math.max(existing.progress, entry.progress),
            totalUnitsOverride:
              existing.totalUnitsOverride ?? entry.totalUnitsOverride,
            score: existing.score ?? entry.score,
            isFavorite: existing.isFavorite || entry.isFavorite,
            notes: mergeNotes(existing.notes, entry.notes),
            startedAt: earliest(existing.startedAt, entry.startedAt),
            completedAt: latest(existing.completedAt, entry.completedAt),
            updatedAt: new Date(),
          })
          .where(eq(libraryEntry.id, existing.id));

        await tx.delete(libraryEntry).where(eq(libraryEntry.id, entry.id));
        mergedEntries += 1;
      }

      const aliases = await tx
        .select()
        .from(seriesAlias)
        .where(eq(seriesAlias.seriesId, source.id));
      if (aliases.length > 0) {
        await tx
          .insert(seriesAlias)
          .values(
            aliases.map((alias) => ({
              id: crypto.randomUUID(),
              seriesId: targetId,
              alias: alias.alias,
              normalizedAlias: alias.normalizedAlias,
            })),
          )
          .onConflictDoNothing();
      }

      await tx
        .update(importEntry)
        .set({ seriesId: targetId })
        .where(eq(importEntry.seriesId, source.id));

      await tx.delete(series).where(eq(series.id, source.id));
    }
  });

  return { mergedSources: sourceRows.length, movedEntries, mergedEntries };
};

export const setUserDisabled = async (
  actorId: string,
  targetId: string,
  disabled: boolean,
) => {
  await assertAdmin(actorId);
  if (targetId === actorId) {
    throw new Error('No puedes desactivar tu propia cuenta');
  }

  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, targetId))
    .limit(1);
  if (!target) throw new Error('El usuario no existe');

  await db
    .update(user)
    .set({ disabled, updatedAt: new Date() })
    .where(eq(user.id, targetId));

  if (disabled) {
    await db.delete(session).where(eq(session.userId, targetId));
  }

  return { disabled };
};

export const revokeUserSessions = async (actorId: string, targetId: string) => {
  await assertAdmin(actorId);
  await db.delete(session).where(eq(session.userId, targetId));
};

export const deleteUserAccount = async (actorId: string, targetId: string) => {
  await assertAdmin(actorId);
  if (targetId === actorId) {
    throw new Error('No puedes eliminar tu propia cuenta');
  }

  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, targetId))
    .limit(1);
  if (!target) throw new Error('El usuario no existe');

  await db.delete(user).where(eq(user.id, targetId));
};

export type MetadataResult = {
  processed: number;
  updated: number;
  failed: number;
};

export const refreshSeriesMetadata = async (
  actorId: string,
  limit = 20,
): Promise<MetadataResult> => {
  await assertAdmin(actorId);
  const take = Math.min(Math.max(limit, 1), 50);

  const rows = await db
    .select()
    .from(series)
    .where(
      and(
        eq(series.provider, 'anilist'),
        or(isNull(series.coverImage), isNull(series.description)),
      ),
    )
    .orderBy(asc(series.updatedAt))
    .limit(take);

  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.providerId) {
      failed += 1;
      continue;
    }
    try {
      const media = await getAniListById(row.providerId, row.type);
      if (!media) {
        failed += 1;
        continue;
      }
      await db
        .update(series)
        .set({
          titleRomaji: media.titleRomaji ?? row.titleRomaji,
          titleNative: media.titleNative ?? row.titleNative,
          description: media.description ?? row.description,
          coverImage: media.coverImage ?? row.coverImage,
          publicationStatus: media.publicationStatus ?? row.publicationStatus,
          year: media.year ?? row.year,
          totalUnits: media.totalUnits ?? row.totalUnits,
          genres: media.genres.length > 0 ? media.genres : row.genres,
          updatedAt: new Date(),
        })
        .where(eq(series.id, row.id));
      updated += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed: rows.length, updated, failed };
};

/**
 * Links imported vault series (no provider) to AniList when the title matches
 * exactly after normalization. Runs sequentially to respect rate limits.
 */
export const enrichUnlinkedSeries = async (
  actorId: string,
  limit = 20,
): Promise<MetadataResult> => {
  await assertAdmin(actorId);
  const result = await enrichUnlinkedBatch({ limit });
  return {
    processed: result.processed,
    updated: result.matched,
    failed: result.failed,
  };
};
