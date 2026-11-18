'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { requestRefresh } from 'waku/router/server';
import { db } from '../../lib/db/client';
import { libraryEntry, series } from '../../lib/db/schema';
import { requireUser } from '../auth/session';
import { getSeriesById } from '../series/queries';
import type { LibraryStatus } from '../series/schema';
import {
  addToLibrarySchema,
  type UpdateEntryInput,
  updateEntrySchema,
} from './schema';

export const addToLibrary = async (
  seriesId: string,
  status: LibraryStatus = 'planning',
) => {
  const user = await requireUser();
  const input = addToLibrarySchema.parse({ seriesId, status });
  const item = await getSeriesById(input.seriesId);
  if (!item) {
    throw new Error('La serie no existe');
  }

  await db
    .insert(libraryEntry)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      seriesId: input.seriesId,
      status: input.status,
      progress: 0,
      startedAt: input.status === 'in_progress' ? new Date() : null,
      completedAt: input.status === 'completed' ? new Date() : null,
    })
    .onConflictDoNothing();

  requestRefresh();
};

export const updateEntry = async (input: UpdateEntryInput) => {
  const user = await requireUser();
  const patch = updateEntrySchema.parse(input);

  const [current] = await db
    .select()
    .from(libraryEntry)
    .where(
      and(eq(libraryEntry.id, patch.entryId), eq(libraryEntry.userId, user.id)),
    )
    .limit(1);

  if (!current) {
    throw new Error('Entrada no encontrada');
  }

  const now = new Date();
  const nextStatus = patch.status ?? current.status;
  const startedAt =
    nextStatus === 'in_progress' && !current.startedAt
      ? now
      : current.startedAt;
  const completedAt =
    nextStatus === 'completed'
      ? (current.completedAt ?? now)
      : current.status === 'completed'
        ? null
        : current.completedAt;

  await db
    .update(libraryEntry)
    .set({
      status: nextStatus,
      progress: Math.max(0, patch.progress ?? current.progress),
      totalUnitsOverride:
        patch.totalUnits === undefined
          ? current.totalUnitsOverride
          : patch.totalUnits,
      score: patch.score === undefined ? current.score : patch.score,
      notes: patch.notes === undefined ? current.notes : patch.notes,
      isFavorite: patch.isFavorite ?? current.isFavorite,
      startedAt,
      completedAt,
      updatedAt: now,
    })
    .where(
      and(eq(libraryEntry.id, patch.entryId), eq(libraryEntry.userId, user.id)),
    );

  requestRefresh();
};

export const removeEntry = async (entryId: string) => {
  const user = await requireUser();
  await db
    .delete(libraryEntry)
    .where(and(eq(libraryEntry.id, entryId), eq(libraryEntry.userId, user.id)));
  requestRefresh();
};

export const getSavedProviderLinks = async (providerIds: string[]) => {
  const user = await requireUser();
  if (providerIds.length === 0) return [];

  const rows = await db
    .select({ providerId: series.providerId, seriesId: series.id })
    .from(libraryEntry)
    .innerJoin(series, eq(libraryEntry.seriesId, series.id))
    .where(
      and(
        eq(libraryEntry.userId, user.id),
        eq(series.provider, 'anilist'),
        inArray(series.providerId, providerIds),
      ),
    );

  return rows.filter((row): row is { providerId: string; seriesId: string } =>
    Boolean(row.providerId),
  );
};
