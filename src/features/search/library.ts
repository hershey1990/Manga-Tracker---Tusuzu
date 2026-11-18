import { db } from '../../lib/db/client';
import { libraryEntry } from '../../lib/db/schema';
import { getEntryBySeries } from '../library/queries';
import { findOrCreateProviderSeries } from '../series/queries';
import type { ProviderSeries } from './types';

export type AddToLibraryResult = {
  seriesId: string;
  linkedExisting: boolean;
  createdSeries: boolean;
  createdEntry: boolean;
};

export const ensureSeriesInLibrary = async (
  userId: string,
  seriesId: string,
): Promise<boolean> => {
  const existing = await getEntryBySeries(userId, seriesId);
  if (existing) return false;

  await db.insert(libraryEntry).values({
    id: crypto.randomUUID(),
    userId,
    seriesId,
    status: 'planning',
    progress: 0,
  });
  return true;
};

/**
 * Persists the provider record in our own `series` table (or enriches an
 * existing local row with that title) and creates the user's library entry.
 */
export const addProviderMediaToLibrary = async (
  userId: string,
  media: ProviderSeries,
): Promise<AddToLibraryResult> => {
  const linked = await findOrCreateProviderSeries(media);
  const createdEntry = await ensureSeriesInLibrary(userId, linked.series.id);

  return {
    seriesId: linked.series.id,
    linkedExisting: linked.linkedExisting,
    createdSeries: linked.createdSeries,
    createdEntry,
  };
};
