'use server';

import { requestRefresh } from 'waku/router/server';
import { db } from '../../lib/db/client';
import { libraryEntry } from '../../lib/db/schema';
import { requireUser } from '../auth/session';
import { getEntryBySeries } from '../library/queries';
import { createSeries } from './queries';
import { type ManualSeriesInput, manualSeriesSchema } from './schema';

export const createManualSeries = async (input: ManualSeriesInput) => {
  const user = await requireUser();
  const parsed = manualSeriesSchema.parse(input);

  const item = await createSeries({
    type: parsed.type,
    title: parsed.title,
    titleRomaji: parsed.titleRomaji || null,
    titleNative: parsed.titleNative || null,
    description: parsed.description || null,
    coverImage: parsed.coverImage || null,
    publicationStatus: null,
    year: parsed.year ?? null,
    totalUnits: parsed.totalUnits ?? null,
    genres: parsed.genres ?? [],
    sourceUrl: parsed.sourceUrl || null,
    provider: null,
    providerId: null,
  });

  const already = await getEntryBySeries(user.id, item.id);
  if (!already) {
    await db.insert(libraryEntry).values({
      id: crypto.randomUUID(),
      userId: user.id,
      seriesId: item.id,
      status: 'planning',
      progress: 0,
    });
  }

  requestRefresh();
  return { seriesId: item.id, created: !already };
};
