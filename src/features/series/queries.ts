import { and, asc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm';
import { db } from '../../lib/db/client';
import {
  type NewSeries,
  type Series,
  series,
  seriesAlias,
} from '../../lib/db/schema';
import { normalizeTitle } from '../../lib/text';
import type { ProviderSeries } from '../search/types';

export const getSeriesById = async (id: string): Promise<Series | null> => {
  const [row] = await db
    .select()
    .from(series)
    .where(eq(series.id, id))
    .limit(1);
  return row ?? null;
};

export const findByProvider = async (
  provider: string,
  providerId: string,
): Promise<Series | null> => {
  const [row] = await db
    .select()
    .from(series)
    .where(
      and(eq(series.provider, provider), eq(series.providerId, providerId)),
    )
    .limit(1);
  return row ?? null;
};

export const findByTitle = async (
  title: string,
  type: NewSeries['type'],
): Promise<Series | null> => {
  const normalized = normalizeTitle(title);
  const [row] = await db
    .select()
    .from(series)
    .where(and(eq(series.type, type), eq(series.normalizedTitle, normalized)))
    .limit(1);
  return row ?? null;
};

type CreateSeriesValues = Omit<NewSeries, 'id' | 'normalizedTitle'> & {
  aliases?: string[];
};

/**
 * Series are canonical and shared between users. Matches an existing provider
 * id first, then an identical normalized title of the same media type.
 */
export const createSeries = async (
  values: CreateSeriesValues,
): Promise<Series> => {
  if (values.provider && values.providerId) {
    const existing = await findByProvider(values.provider, values.providerId);
    if (existing) return existing;
  }

  const existingByTitle = await findByTitle(values.title, values.type);
  if (existingByTitle) {
    if (values.coverImage && !existingByTitle.coverImage) {
      await db
        .update(series)
        .set({ coverImage: values.coverImage })
        .where(eq(series.id, existingByTitle.id));
    }
    return existingByTitle;
  }

  const id = crypto.randomUUID();
  const { aliases = [], ...rest } = values;
  await db.insert(series).values({
    id,
    ...rest,
    title: values.title.trim(),
    normalizedTitle: normalizeTitle(values.title),
  });

  const uniqueAliases = [
    ...new Set(
      aliases
        .map((alias) => alias.trim())
        .filter(
          (alias) =>
            alias.length > 1 &&
            normalizeTitle(alias) !== normalizeTitle(values.title),
        ),
    ),
  ];

  if (uniqueAliases.length > 0) {
    await db
      .insert(seriesAlias)
      .values(
        uniqueAliases.map((alias) => ({
          id: crypto.randomUUID(),
          seriesId: id,
          alias,
          normalizedAlias: normalizeTitle(alias),
        })),
      )
      .onConflictDoNothing();
  }

  const created = await getSeriesById(id);
  if (!created) {
    throw new Error('No se pudo crear la serie');
  }
  return created;
};

export const searchLocalSeries = async (
  query: string,
  type: 'manga' | 'anime' | 'all' = 'all',
): Promise<Series[]> => {
  const normalized = normalizeTitle(query);
  if (!normalized) return [];

  // Every meaningful token must appear in the title or one of its aliases.
  // This lets "100 kanojo" find a series stored with its long romaji title.
  const tokens = normalized.split(' ').filter((token) => token.length >= 2);
  const terms = tokens.length > 0 ? tokens : [normalized];

  const conditions = terms.map((term) => {
    const pattern = `%${term}%`;
    return or(
      like(series.normalizedTitle, pattern),
      sql`exists (
        select 1 from ${seriesAlias}
        where ${seriesAlias.seriesId} = ${series.id}
          and ${seriesAlias.normalizedAlias} like ${pattern}
      )`,
    )!;
  });

  return db
    .select()
    .from(series)
    .where(
      and(
        type === 'all' ? undefined : eq(series.type, type),
        and(...conditions),
      ),
    )
    .orderBy(asc(series.title))
    .limit(12);
};

export const listSeriesAliases = async (seriesId: string) => {
  return db
    .select()
    .from(seriesAlias)
    .where(eq(seriesAlias.seriesId, seriesId));
};

export const findUnlinkedByTitles = async (
  titles: string[],
  type: NewSeries['type'],
): Promise<Series | null> => {
  const keys = [
    ...new Set(titles.map((title) => normalizeTitle(title))),
  ].filter((key) => key.length > 0);

  if (keys.length === 0) return null;

  const [byTitle] = await db
    .select()
    .from(series)
    .where(
      and(
        eq(series.type, type),
        isNull(series.provider),
        inArray(series.normalizedTitle, keys),
      ),
    )
    .limit(1);
  if (byTitle) return byTitle;

  const [alias] = await db
    .select({ seriesId: seriesAlias.seriesId })
    .from(seriesAlias)
    .where(inArray(seriesAlias.normalizedAlias, keys))
    .limit(1);
  if (!alias) return null;

  const [byAlias] = await db
    .select()
    .from(series)
    .where(and(eq(series.id, alias.seriesId), isNull(series.provider)))
    .limit(1);
  return byAlias ?? null;
};

/**
 * Copies provider metadata into an existing local series. Used when an imported
 * vault record is matched later from search, so we enrich the local row instead
 * of creating a duplicate.
 */
export const insertSeriesAliases = async (
  seriesId: string,
  localTitle: string,
  titles: (string | null | undefined)[],
) => {
  const normalizedLocal = normalizeTitle(localTitle);
  const aliases = titles
    .filter((value): value is string => Boolean(value))
    .filter((alias) => normalizeTitle(alias) !== normalizedLocal);
  if (aliases.length === 0) return;

  await db
    .insert(seriesAlias)
    .values(
      [...new Set(aliases)].map((alias) => ({
        id: crypto.randomUUID(),
        seriesId,
        alias,
        normalizedAlias: normalizeTitle(alias),
      })),
    )
    .onConflictDoNothing();
};

export const applyProviderMetadata = async (
  row: Series,
  media: ProviderSeries,
): Promise<Series> => {
  const mediaTitles = [
    media.title,
    media.titleRomaji,
    media.titleNative,
    ...(media.synonyms ?? []),
  ].filter((value): value is string => Boolean(value));

  await db
    .update(series)
    .set({
      provider: media.provider,
      providerId: media.providerId,
      titleRomaji: media.titleRomaji ?? row.titleRomaji,
      titleNative: media.titleNative ?? row.titleNative,
      description: media.description ?? row.description,
      coverImage: media.coverImage ?? row.coverImage,
      publicationStatus: media.publicationStatus ?? row.publicationStatus,
      year: media.year ?? row.year,
      totalUnits: media.totalUnits ?? row.totalUnits,
      genres: media.genres.length > 0 ? media.genres : row.genres,
      sourceUrl:
        media.provider === 'anilist'
          ? `https://anilist.co/${media.type}/${media.providerId}`
          : row.sourceUrl,
      updatedAt: new Date(),
    })
    .where(eq(series.id, row.id));

  const aliases = mediaTitles.filter(
    (alias) => normalizeTitle(alias) !== normalizeTitle(row.title),
  );
  if (aliases.length > 0) {
    await insertSeriesAliases(row.id, row.title, aliases);
  }

  return (await getSeriesById(row.id)) ?? row;
};

export type ProviderLinkResult = {
  series: Series;
  linkedExisting: boolean;
  createdSeries: boolean;
};

export const findOrCreateProviderSeries = async (
  media: ProviderSeries,
): Promise<ProviderLinkResult> => {
  const byProvider = await findByProvider(media.provider, media.providerId);
  if (byProvider) {
    return { series: byProvider, linkedExisting: false, createdSeries: false };
  }

  const candidates = [
    media.title,
    media.titleRomaji,
    media.titleNative,
    ...(media.synonyms ?? []),
  ].filter((value): value is string => Boolean(value));

  const byTitle = await findByTitle(media.title, media.type);
  const unlinked =
    byTitle?.provider === null
      ? byTitle
      : await findUnlinkedByTitles(candidates, media.type);

  if (unlinked) {
    const updated = await applyProviderMetadata(unlinked, media);
    return { series: updated, linkedExisting: true, createdSeries: false };
  }

  const created = await createSeries({
    type: media.type,
    title: media.title,
    titleRomaji: media.titleRomaji,
    titleNative: media.titleNative,
    description: media.description,
    coverImage: media.coverImage,
    publicationStatus: media.publicationStatus,
    year: media.year,
    totalUnits: media.totalUnits,
    genres: media.genres,
    provider: media.provider,
    providerId: media.providerId,
    sourceUrl: `https://anilist.co/${media.type}/${media.providerId}`,
    aliases: candidates,
  });

  return { series: created, linkedExisting: false, createdSeries: true };
};
