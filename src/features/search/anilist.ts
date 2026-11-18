import { eq, lt } from 'drizzle-orm';
import { db } from '../../lib/db/client';
import { providerCache } from '../../lib/db/schema';
import { normalizeTitle, stripHtml } from '../../lib/text';
import type { SeriesType } from '../series/schema';
import type { ProviderSeries } from './types';

const ENDPOINT = 'https://graphql.anilist.co';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

type AniListMedia = {
  id: number;
  type: 'ANIME' | 'MANGA';
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  synonyms?: string[] | null;
  description?: string | null;
  coverImage?: { large?: string | null; extraLarge?: string | null } | null;
  status?: string | null;
  startDate?: { year?: number | null } | null;
  episodes?: number | null;
  chapters?: number | null;
  genres?: string[] | null;
};

const MEDIA_FIELDS = `
  id
  type
  title { romaji english native }
  synonyms
  description
  coverImage { large extraLarge }
  status
  startDate { year }
  episodes
  chapters
  genres
`;

const toProviderSeries = (media: AniListMedia): ProviderSeries => ({
  provider: 'anilist',
  providerId: String(media.id),
  type: media.type === 'ANIME' ? 'anime' : 'manga',
  title:
    media.title.english?.trim() ||
    media.title.romaji?.trim() ||
    media.title.native?.trim() ||
    `AniList #${media.id}`,
  titleRomaji: media.title.romaji ?? null,
  titleNative: media.title.native ?? null,
  synonyms: media.synonyms ?? [],
  description: media.description ? stripHtml(media.description) : null,
  coverImage: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
  publicationStatus: media.status ?? null,
  year: media.startDate?.year ?? null,
  totalUnits:
    media.type === 'ANIME'
      ? (media.episodes ?? null)
      : (media.chapters ?? null),
  genres: media.genres ?? [],
});

const readCache = async <T>(key: string): Promise<T | null> => {
  const [row] = await db
    .select()
    .from(providerCache)
    .where(eq(providerCache.key, key))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return row.payload as T;
};

const writeCache = async (key: string, payload: unknown) => {
  const now = new Date();
  await db
    .insert(providerCache)
    .values({
      key,
      payload: payload as never,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: providerCache.key,
      set: {
        payload: payload as never,
        expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      },
    });
};

export const purgeExpiredCache = async () => {
  await db.delete(providerCache).where(lt(providerCache.expiresAt, new Date()));
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const request = async <T>(
  query: string,
  variables: Record<string, unknown>,
  attempt = 0,
): Promise<T> => {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12000),
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt < 3) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 2000 * (attempt + 1);
      await sleep(wait);
      return request(query, variables, attempt + 1);
    }
  }

  if (!response.ok) {
    throw new Error(`AniList respondió ${response.status}`);
  }

  const body = (await response.json()) as {
    data?: T;
    errors?: { message?: string }[];
  };

  if (body.errors?.length) {
    throw new Error(body.errors[0]?.message ?? 'Error de AniList');
  }
  if (!body.data) {
    throw new Error('AniList no devolvió datos');
  }
  return body.data;
};

export const searchAniList = async (
  search: string,
  type: SeriesType | 'all',
): Promise<ProviderSeries[]> => {
  const trimmed = search.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = `anilist:search:${type}:${normalizeTitle(trimmed)}`;
  const cached = await readCache<ProviderSeries[]>(cacheKey);
  if (cached) return cached;

  const data = await request<{ Page: { media: AniListMedia[] } }>(
    `query ($search: String, $type: MediaType) {
      Page(page: 1, perPage: 18) {
        media(search: $search, type: $type, sort: SEARCH_MATCH) {
          ${MEDIA_FIELDS}
        }
      }
    }`,
    {
      search: trimmed,
      ...(type === 'all' ? {} : { type: type === 'anime' ? 'ANIME' : 'MANGA' }),
    },
  );

  const results = data.Page.media.map(toProviderSeries);
  await writeCache(cacheKey, results);
  return results;
};

export type BatchSearchQuery = {
  key: string;
  title: string;
  type: SeriesType;
  searchTerm?: string;
  variant?: string;
};

const BATCH_SIZE = 8;
const BATCH_DELAY_MS = 2000;

/**
 * Resolves several title searches in one GraphQL request using aliases.
 * AniList limits search requests (not just rows), so batching is what makes a
 * 756-title import practical. Results are cached per query like single searches.
 */
export const searchAniListBatch = async (
  queries: BatchSearchQuery[],
): Promise<Map<string, ProviderSeries[]>> => {
  const results = new Map<string, ProviderSeries[]>();
  const pending: { query: BatchSearchQuery; cacheKey: string }[] = [];

  for (const query of queries) {
    const title = query.title.trim();
    if (title.length < 2) {
      results.set(query.key, []);
      continue;
    }
    const cacheKey = `anilist:search:${query.type}:${normalizeTitle(title)}${
      query.variant ? `:${query.variant}` : ''
    }`;
    const cached = await readCache<ProviderSeries[]>(cacheKey);
    if (cached) {
      results.set(query.key, cached);
      continue;
    }
    pending.push({ query: { ...query, title }, cacheKey });
  }

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const chunk = pending.slice(start, start + BATCH_SIZE);
    const definitions = chunk
      .map((_, index) => `$q${index}: String!, $t${index}: MediaType`)
      .join(', ');
    const fields = chunk
      .map(
        (_, index) =>
          `r${index}: Page(page: 1, perPage: 8) { media(search: $q${index}, type: $t${index}, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} } }`,
      )
      .join('\n');

    const variables = Object.fromEntries(
      chunk.flatMap((item, index) => [
        [`q${index}`, item.query.searchTerm ?? item.query.title],
        [`t${index}`, item.query.type === 'anime' ? 'ANIME' : 'MANGA'],
      ]),
    );

    const data = await request<
      Record<string, { media: AniListMedia[] } | undefined>
    >(`query (${definitions}) {\n${fields}\n}`, variables);

    for (const [index, item] of chunk.entries()) {
      const media = data[`r${index}`]?.media ?? [];
      const mapped = media.map(toProviderSeries);
      results.set(item.query.key, mapped);
      await writeCache(item.cacheKey, mapped);
    }

    if (start + BATCH_SIZE < pending.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
};

export const getAniListById = async (
  providerId: string,
  type: SeriesType,
): Promise<ProviderSeries | null> => {
  const id = Number.parseInt(providerId, 10);
  if (!Number.isFinite(id)) return null;

  const cacheKey = `anilist:id:${type}:${id}`;
  const cached = await readCache<ProviderSeries>(cacheKey);
  if (cached) return cached;

  const data = await request<{ Media: AniListMedia | null }>(
    `query ($id: Int, $type: MediaType) {
      Media(id: $id, type: $type) {
        ${MEDIA_FIELDS}
      }
    }`,
    { id, type: type === 'anime' ? 'ANIME' : 'MANGA' },
  );

  if (!data.Media) return null;
  const result = toProviderSeries(data.Media);
  await writeCache(cacheKey, result);
  return result;
};

export type MediaRef = { providerId: string; type: SeriesType };

const refKey = (ref: MediaRef) => `${ref.type}:${ref.providerId}`;

const BY_ID_BATCH = 8;
const BY_ID_DELAY_MS = 2000;

/**
 * Fetches several known AniList ids in one request. Used to backfill aliases
 * (including localized synonyms) for series already linked in our database.
 */
export const getAniListByIds = async (
  refs: MediaRef[],
): Promise<Map<string, ProviderSeries>> => {
  const results = new Map<string, ProviderSeries>();
  const pending: MediaRef[] = [];

  for (const ref of refs) {
    const id = Number.parseInt(ref.providerId, 10);
    if (!Number.isFinite(id)) continue;

    const cached = await readCache<ProviderSeries>(
      `anilist:id:${ref.type}:${id}`,
    );
    if (cached) {
      results.set(refKey(ref), cached);
      continue;
    }
    pending.push(ref);
  }

  for (let start = 0; start < pending.length; start += BY_ID_BATCH) {
    const chunk = pending.slice(start, start + BY_ID_BATCH);
    const definitions = chunk
      .map((_, index) => `$id${index}: Int, $t${index}: MediaType`)
      .join(', ');
    const fields = chunk
      .map(
        (_, index) =>
          `m${index}: Media(id: $id${index}, type: $t${index}) { ${MEDIA_FIELDS} }`,
      )
      .join('\n');
    const variables = Object.fromEntries(
      chunk.flatMap((ref, index) => [
        [`id${index}`, Number.parseInt(ref.providerId, 10)],
        [`t${index}`, ref.type === 'anime' ? 'ANIME' : 'MANGA'],
      ]),
    );

    const data = await request<Record<string, AniListMedia | null>>(
      `query (${definitions}) {\n${fields}\n}`,
      variables,
    );

    for (const [index, ref] of chunk.entries()) {
      const media = data[`m${index}`];
      if (!media) continue;
      const mapped = toProviderSeries(media);
      results.set(refKey(ref), mapped);
      await writeCache(`anilist:id:${ref.type}:${media.id}`, mapped);
    }

    if (start + BY_ID_BATCH < pending.length) {
      await sleep(BY_ID_DELAY_MS);
    }
  }

  return results;
};
