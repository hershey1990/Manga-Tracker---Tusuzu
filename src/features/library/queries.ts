import { and, asc, count, desc, eq, like, or, sql } from 'drizzle-orm';
import { db } from '../../lib/db/client';
import { libraryEntry, series, seriesAlias } from '../../lib/db/schema';
import { normalizeTitle } from '../../lib/text';
import type { LibraryStatus, SeriesType } from '../series/schema';
import type { LibraryFilters } from './schema';

export type LibraryItem = {
  entryId: string;
  seriesId: string;
  type: SeriesType;
  title: string;
  coverImage: string | null;
  status: LibraryStatus;
  progress: number;
  totalUnits: number | null;
  score: number | null;
  notes: string | null;
  isFavorite: boolean;
  year: number | null;
  providerStatus: string | null;
  sourceUrl: string | null;
  updatedAt: Date;
};

const PAGE_SIZE = 48;

const toItem = (row: {
  entry: typeof libraryEntry.$inferSelect;
  item: typeof series.$inferSelect;
}): LibraryItem => ({
  entryId: row.entry.id,
  seriesId: row.item.id,
  type: row.item.type,
  title: row.item.title,
  coverImage: row.item.coverImage,
  status: row.entry.status,
  progress: row.entry.progress,
  totalUnits: row.entry.totalUnitsOverride ?? row.item.totalUnits,
  score: row.entry.score,
  notes: row.entry.notes,
  isFavorite: row.entry.isFavorite,
  year: row.item.year,
  providerStatus: row.item.publicationStatus,
  sourceUrl: row.item.sourceUrl,
  updatedAt: row.entry.updatedAt,
});

const buildWhere = (userId: string, filters: LibraryFilters) => {
  const clauses = [eq(libraryEntry.userId, userId)];
  if (filters.type !== 'all') {
    clauses.push(eq(series.type, filters.type));
  }
  if (filters.status !== 'all') {
    clauses.push(eq(libraryEntry.status, filters.status));
  }
  if (filters.q) {
    const pattern = `%${normalizeTitle(filters.q)}%`;
    clauses.push(
      or(
        like(series.normalizedTitle, pattern),
        sql`exists (
          select 1 from ${seriesAlias}
          where ${seriesAlias.seriesId} = ${series.id}
            and ${seriesAlias.normalizedAlias} like ${pattern}
        )`,
      )!,
    );
  }
  return and(...clauses);
};

const orderBy = (sort: LibraryFilters['sort']) => {
  switch (sort) {
    case 'title':
      return [asc(series.title)];
    case 'score':
      return [desc(libraryEntry.score), asc(series.title)];
    case 'progress':
      return [desc(libraryEntry.progress), asc(series.title)];
    default:
      return [desc(libraryEntry.updatedAt), asc(series.title)];
  }
};

export const listLibrary = async (
  userId: string,
  filters: LibraryFilters,
): Promise<{ items: LibraryItem[]; total: number; pageSize: number }> => {
  const where = buildWhere(userId, filters);
  const offset = (filters.page - 1) * PAGE_SIZE;

  const rows = await db
    .select({ entry: libraryEntry, item: series })
    .from(libraryEntry)
    .innerJoin(series, eq(libraryEntry.seriesId, series.id))
    .where(where)
    .orderBy(...orderBy(filters.sort))
    .limit(PAGE_SIZE)
    .offset(offset);

  const [totalRow] = await db
    .select({ value: count() })
    .from(libraryEntry)
    .innerJoin(series, eq(libraryEntry.seriesId, series.id))
    .where(where);

  return {
    items: rows.map(toItem),
    total: totalRow?.value ?? 0,
    pageSize: PAGE_SIZE,
  };
};

export const getEntryById = async (userId: string, entryId: string) => {
  const [row] = await db
    .select({ entry: libraryEntry, item: series })
    .from(libraryEntry)
    .innerJoin(series, eq(libraryEntry.seriesId, series.id))
    .where(and(eq(libraryEntry.id, entryId), eq(libraryEntry.userId, userId)))
    .limit(1);
  return row ? toItem(row) : null;
};

export const getEntryBySeries = async (userId: string, seriesId: string) => {
  const [row] = await db
    .select({ entry: libraryEntry, item: series })
    .from(libraryEntry)
    .innerJoin(series, eq(libraryEntry.seriesId, series.id))
    .where(
      and(eq(libraryEntry.seriesId, seriesId), eq(libraryEntry.userId, userId)),
    )
    .limit(1);
  return row ? toItem(row) : null;
};

export const getRecentEntries = async (userId: string, limit = 6) => {
  const rows = await db
    .select({ entry: libraryEntry, item: series })
    .from(libraryEntry)
    .innerJoin(series, eq(libraryEntry.seriesId, series.id))
    .where(eq(libraryEntry.userId, userId))
    .orderBy(desc(libraryEntry.updatedAt))
    .limit(limit);
  return rows.map(toItem);
};

export const getEntriesByStatus = async (
  userId: string,
  status: LibraryStatus,
  limit = 6,
) => {
  const rows = await db
    .select({ entry: libraryEntry, item: series })
    .from(libraryEntry)
    .innerJoin(series, eq(libraryEntry.seriesId, series.id))
    .where(
      and(eq(libraryEntry.userId, userId), eq(libraryEntry.status, status)),
    )
    .orderBy(desc(libraryEntry.updatedAt))
    .limit(limit);
  return rows.map(toItem);
};

export type LibraryStats = {
  total: number;
  byStatus: Record<LibraryStatus, number>;
  byType: Record<SeriesType, number>;
  favorites: number;
  unitsRead: number;
  meanScore: number | null;
};

export const getLibraryStats = async (
  userId: string,
): Promise<LibraryStats> => {
  const statusRows = await db
    .select({ status: libraryEntry.status, value: count() })
    .from(libraryEntry)
    .where(eq(libraryEntry.userId, userId))
    .groupBy(libraryEntry.status);

  const typeRows = await db
    .select({ type: series.type, value: count() })
    .from(libraryEntry)
    .innerJoin(series, eq(libraryEntry.seriesId, series.id))
    .where(eq(libraryEntry.userId, userId))
    .groupBy(series.type);

  const [aggregate] = await db
    .select({
      total: count(),
      favorites: sql<number>`coalesce(sum(case when ${libraryEntry.isFavorite} then 1 else 0 end), 0)`,
      unitsRead: sql<number>`coalesce(sum(${libraryEntry.progress}), 0)`,
      meanScore: sql<number | null>`avg(${libraryEntry.score})`,
    })
    .from(libraryEntry)
    .where(eq(libraryEntry.userId, userId));

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

  const byType = { manga: 0, anime: 0 } satisfies Record<SeriesType, number>;
  for (const row of typeRows) {
    byType[row.type] = row.value;
  }

  return {
    total: aggregate?.total ?? 0,
    byStatus,
    byType,
    favorites: Number(aggregate?.favorites ?? 0),
    unitsRead: Number(aggregate?.unitsRead ?? 0),
    meanScore:
      aggregate?.meanScore != null ? Number(aggregate.meanScore) : null,
  };
};

export const listEntriesForExport = async (userId: string) => {
  const rows = await db
    .select({ entry: libraryEntry, item: series })
    .from(libraryEntry)
    .innerJoin(series, eq(libraryEntry.seriesId, series.id))
    .where(eq(libraryEntry.userId, userId))
    .orderBy(asc(series.title));
  return rows.map(toItem);
};
