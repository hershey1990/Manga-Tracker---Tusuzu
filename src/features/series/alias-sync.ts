import { and, asc, count, eq, gt, isNotNull } from 'drizzle-orm';
import { db } from '../../lib/db/client';
import { series } from '../../lib/db/schema';
import { getAniListByIds } from '../search/anilist';
import { insertSeriesAliases } from './queries';

export type AliasSyncResult = {
  processed: number;
  updated: number;
  failed: number;
  total: number;
  nextCursor: string | null;
  done: boolean;
};

/**
 * Backfills aliases and localized synonyms for series already linked to
 * AniList. New adds store them immediately; this handles older rows.
 */
export const syncAliasesBatch = async ({
  limit = 40,
  cursor,
}: {
  limit?: number | undefined;
  cursor?: string | undefined;
} = {}): Promise<AliasSyncResult> => {
  const take = Math.min(Math.max(limit, 1), 40);

  const [totalRow] = await db
    .select({ value: count() })
    .from(series)
    .where(and(eq(series.provider, 'anilist'), isNotNull(series.providerId)));

  const rows = await db
    .select()
    .from(series)
    .where(
      and(
        eq(series.provider, 'anilist'),
        isNotNull(series.providerId),
        cursor ? gt(series.id, cursor) : undefined,
      ),
    )
    .orderBy(asc(series.id))
    .limit(take);

  if (rows.length === 0) {
    return {
      processed: 0,
      updated: 0,
      failed: 0,
      total: totalRow?.value ?? 0,
      nextCursor: cursor ?? null,
      done: true,
    };
  }

  let updated = 0;
  let failed = 0;

  try {
    const media = await getAniListByIds(
      rows.map((row) => ({
        providerId: row.providerId!,
        type: row.type,
      })),
    );

    for (const row of rows) {
      const match = media.get(`${row.type}:${row.providerId}`);
      if (!match) {
        failed += 1;
        continue;
      }
      try {
        await insertSeriesAliases(row.id, row.title, [
          match.title,
          match.titleRomaji,
          match.titleNative,
          ...match.synonyms,
        ]);
        updated += 1;
      } catch {
        failed += 1;
      }
    }
  } catch {
    failed += rows.length;
  }

  return {
    processed: rows.length,
    updated,
    failed,
    total: totalRow?.value ?? 0,
    nextCursor: rows.at(-1)?.id ?? cursor ?? null,
    done: rows.length < take,
  };
};
