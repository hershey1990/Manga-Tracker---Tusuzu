import { and, asc, count, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../lib/db/client';
import {
  libraryEntry,
  type Series,
  series,
  seriesAlias,
} from '../../lib/db/schema';
import { normalizeTitle } from '../../lib/text';
import { searchAniListBatch } from '../search/anilist';
import type { ProviderSeries } from '../search/types';

export type EnrichmentBatchResult = {
  processed: number;
  matched: number;
  failed: number;
  remaining: number;
  total: number;
  nextCursor: string | null;
  done: boolean;
};

const pendingCondition = (userId?: string) =>
  and(
    isNull(series.provider),
    or(isNull(series.coverImage), isNull(series.description)),
    userId
      ? sql`exists (select 1 from ${libraryEntry} where ${libraryEntry.seriesId} = ${series.id} and ${libraryEntry.userId} = ${userId})`
      : undefined,
  );

export const countPendingEnrichment = async (userId?: string) => {
  const [row] = await db
    .select({ value: count() })
    .from(series)
    .where(pendingCondition(userId));
  return row?.value ?? 0;
};

const matchKey = (value: string) =>
  normalizeTitle(value).replace(/^(the|a|an)\s+/, '');

const apostropheVariant = (title: string) =>
  title.replace(/-([st])\b/gi, "'$1");

const acceptMatch = async (row: Series, results: ProviderSeries[]) => {
  const wanted = matchKey(row.title);
  const match = results.find((candidate) => {
    if (candidate.type !== row.type) return false;
    return [
      candidate.title,
      candidate.titleRomaji,
      candidate.titleNative,
      ...(candidate.synonyms ?? []),
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => matchKey(value) === wanted);
  });

  if (!match) return false;

  const [taken] = await db
    .select({ id: series.id })
    .from(series)
    .where(
      and(
        eq(series.provider, match.provider),
        eq(series.providerId, match.providerId),
      ),
    )
    .limit(1);

  if (taken && taken.id !== row.id) {
    return false;
  }

  await db
    .update(series)
    .set({
      provider: match.provider,
      providerId: match.providerId,
      titleRomaji: match.titleRomaji,
      titleNative: match.titleNative,
      description: match.description,
      coverImage: match.coverImage,
      publicationStatus: match.publicationStatus,
      year: match.year,
      totalUnits: match.totalUnits,
      genres: match.genres,
      sourceUrl: `https://anilist.co/${row.type}/${match.providerId}`,
      updatedAt: new Date(),
    })
    .where(eq(series.id, row.id));

  const aliases = [
    match.title,
    match.titleRomaji,
    match.titleNative,
    ...(match.synonyms ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value) => normalizeTitle(value) !== row.normalizedTitle);

  if (aliases.length > 0) {
    await db
      .insert(seriesAlias)
      .values(
        [...new Set(aliases)].map((alias) => ({
          id: crypto.randomUUID(),
          seriesId: row.id,
          alias,
          normalizedAlias: normalizeTitle(alias),
        })),
      )
      .onConflictDoNothing();
  }

  return true;
};

/**
 * Copies AniList metadata into our own `series` rows. AniList is a source at
 * import time only: every read afterwards comes from our database.
 *
 * Without `userId` it processes the whole instance (admin tools); with a user
 * id it only touches series present in that user's library.
 */
export const enrichUnlinkedBatch = async ({
  userId,
  limit = 20,
  cursor,
}: {
  userId?: string | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
} = {}): Promise<EnrichmentBatchResult> => {
  const take = Math.min(Math.max(limit, 1), 40);
  const total = await countPendingEnrichment(userId);

  const rows = await db
    .select()
    .from(series)
    .where(
      and(pendingCondition(userId), cursor ? gt(series.id, cursor) : undefined),
    )
    .orderBy(asc(series.id))
    .limit(take);

  let matched = 0;
  let failed = 0;
  const retryRows: Series[] = [];

  const CHUNK = 8;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    let results: Map<string, ProviderSeries[]>;
    try {
      results = await searchAniListBatch(
        chunk.map((row) => ({
          key: row.id,
          title: row.title,
          type: row.type,
        })),
      );
    } catch {
      failed += chunk.length;
      continue;
    }

    for (const row of chunk) {
      try {
        if (await acceptMatch(row, results.get(row.id) ?? [])) {
          matched += 1;
        } else if (
          normalizeTitle(row.title) !==
          row.title.trim().toLowerCase().replace(/\s+/g, ' ')
        ) {
          retryRows.push(row);
        }
      } catch {
        failed += 1;
      }
    }
  }

  // A second query with punctuation normalized catches titles like
  // "Darwin-s Game" that AniList only finds as "Darwin's Game".
  const apostropheRows: Series[] = [];
  if (retryRows.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    for (let start = 0; start < retryRows.length; start += CHUNK) {
      const chunk = retryRows.slice(start, start + CHUNK);
      let results: Map<string, ProviderSeries[]>;
      try {
        results = await searchAniListBatch(
          chunk.map((row) => ({
            key: row.id,
            title: row.title,
            searchTerm: normalizeTitle(row.title),
            variant: 'normalized',
            type: row.type,
          })),
        );
      } catch {
        failed += chunk.length;
        continue;
      }

      for (const row of chunk) {
        try {
          if (await acceptMatch(row, results.get(row.id) ?? [])) {
            matched += 1;
          } else if (apostropheVariant(row.title) !== row.title) {
            apostropheRows.push(row);
          }
        } catch {
          failed += 1;
        }
      }
    }
  }

  // Filesystem-safe titles sometimes replace apostrophes with hyphens
  // ("Darwin-s Game"). AniList needs the apostrophe to find them.
  if (apostropheRows.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    for (let start = 0; start < apostropheRows.length; start += CHUNK) {
      const chunk = apostropheRows.slice(start, start + CHUNK);
      let results: Map<string, ProviderSeries[]>;
      try {
        results = await searchAniListBatch(
          chunk.map((row) => ({
            key: row.id,
            title: row.title,
            searchTerm: apostropheVariant(row.title),
            variant: 'apostrophe',
            type: row.type,
          })),
        );
      } catch {
        failed += chunk.length;
        continue;
      }

      for (const row of chunk) {
        try {
          if (await acceptMatch(row, results.get(row.id) ?? [])) {
            matched += 1;
          }
        } catch {
          failed += 1;
        }
      }
    }
  }

  return {
    processed: rows.length,
    matched,
    failed,
    remaining: await countPendingEnrichment(userId),
    total,
    nextCursor: rows.at(-1)?.id ?? cursor ?? null,
    done: rows.length < take,
  };
};
