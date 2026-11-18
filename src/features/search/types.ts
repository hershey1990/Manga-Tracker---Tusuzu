import type { SeriesType } from '../series/schema';

export type ProviderSeries = {
  provider: 'anilist';
  providerId: string;
  type: SeriesType;
  title: string;
  titleRomaji: string | null;
  titleNative: string | null;
  synonyms: string[];
  description: string | null;
  coverImage: string | null;
  publicationStatus: string | null;
  year: number | null;
  totalUnits: number | null;
  genres: string[];
};

export type SearchOutcome = {
  results: ProviderSeries[];
  error: string | null;
};
