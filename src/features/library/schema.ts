import { z } from 'zod';
import { libraryStatusSchema } from '../series/schema';

export const libraryFilterSchema = z.object({
  type: z.enum(['all', 'manga', 'anime']).default('all'),
  status: z
    .enum(['all', 'planning', 'in_progress', 'completed', 'paused', 'dropped'])
    .default('all'),
  q: z.string().trim().max(200).default(''),
  sort: z.enum(['updated', 'title', 'score', 'progress']).default('updated'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type LibraryFilters = z.infer<typeof libraryFilterSchema>;

export const updateEntrySchema = z.object({
  entryId: z.string().uuid(),
  status: libraryStatusSchema.optional(),
  progress: z.coerce.number().int().min(0).max(100000).optional(),
  totalUnits: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  score: z.coerce.number().int().min(0).max(10).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  isFavorite: z.boolean().optional(),
});
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;

export const addToLibrarySchema = z.object({
  seriesId: z.string().uuid(),
  status: libraryStatusSchema.default('planning'),
});
