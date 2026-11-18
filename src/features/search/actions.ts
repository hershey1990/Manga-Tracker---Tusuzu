'use server';

import { requireUser } from '../auth/session';
import { findByProvider } from '../series/queries';
import { getAniListById, searchAniList } from './anilist';
import { addProviderMediaToLibrary, ensureSeriesInLibrary } from './library';
import type { SearchOutcome } from './types';

export const searchProvider = async (
  query: string,
  type: 'all' | 'anime' | 'manga',
): Promise<SearchOutcome> => {
  await requireUser();
  try {
    const results = await searchAniList(query, type);
    return { results, error: null };
  } catch (error) {
    return {
      results: [],
      error:
        error instanceof Error ? error.message : 'No se pudo consultar AniList',
    };
  }
};

export const addProviderSeries = async (
  providerId: string,
  type: 'anime' | 'manga',
) => {
  const user = await requireUser();

  // Already stored locally: no need to hit the provider again.
  const existing = await findByProvider('anilist', providerId);
  if (existing) {
    const createdEntry = await ensureSeriesInLibrary(user.id, existing.id);
    return {
      seriesId: existing.id,
      linkedExisting: false,
      createdSeries: false,
      createdEntry,
    };
  }

  const media = await getAniListById(providerId, type);
  if (!media) {
    throw new Error('No se encontró la serie en AniList');
  }

  // Copies metadata into our DB, or enriches a matching local (vault) row.
  return addProviderMediaToLibrary(user.id, media);
};
