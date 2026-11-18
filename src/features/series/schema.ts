import { z } from 'zod';

export const seriesTypeSchema = z.enum(['manga', 'anime']);
export type SeriesType = z.infer<typeof seriesTypeSchema>;

export const libraryStatusSchema = z.enum([
  'planning',
  'in_progress',
  'completed',
  'paused',
  'dropped',
]);
export type LibraryStatus = z.infer<typeof libraryStatusSchema>;

export const manualSeriesSchema = z.object({
  type: seriesTypeSchema,
  title: z.string().trim().min(1, 'El título es obligatorio').max(300),
  titleRomaji: z.string().trim().max(300).optional(),
  titleNative: z.string().trim().max(300).optional(),
  description: z.string().trim().max(5000).optional(),
  coverImage: z.string().trim().url().optional().or(z.literal('')),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  totalUnits: z.coerce.number().int().min(0).max(100000).optional(),
  genres: z.array(z.string().trim().min(1)).max(20).optional(),
  sourceUrl: z.string().trim().url().optional().or(z.literal('')),
});
export type ManualSeriesInput = z.infer<typeof manualSeriesSchema>;

export const STATUS_META: Record<
  LibraryStatus,
  {
    label: (type: SeriesType) => string;
    short: string;
    tone: string;
    dot: string;
  }
> = {
  planning: {
    label: (type) => (type === 'anime' ? 'Por ver' : 'Pendiente'),
    short: 'Pendiente',
    tone: 'bg-slate-500/10 text-slate-300 border-slate-500/25',
    dot: 'bg-slate-400',
  },
  in_progress: {
    label: (type) => (type === 'anime' ? 'Viendo' : 'Leyendo'),
    short: 'En curso',
    tone: 'bg-accent/12 text-[#a9bcff] border-accent/30',
    dot: 'bg-accent',
  },
  completed: {
    label: () => 'Completado',
    short: 'Completado',
    tone: 'bg-mint/10 text-[#8be6c6] border-mint/25',
    dot: 'bg-mint',
  },
  paused: {
    label: () => 'En pausa',
    short: 'En pausa',
    tone: 'bg-amber/10 text-[#f3cc85] border-amber/25',
    dot: 'bg-amber',
  },
  dropped: {
    label: () => 'Abandonado',
    short: 'Abandonado',
    tone: 'bg-rose/10 text-[#f49bb2] border-rose/25',
    dot: 'bg-rose',
  },
};

export const PROVIDER_STATUS_LABELS: Record<string, string> = {
  FINISHED: 'Finalizado',
  RELEASING: 'En publicación',
  NOT_YET_RELEASED: 'Próximamente',
  CANCELLED: 'Cancelado',
  HIATUS: 'En pausa',
};

export const statusLabel = (status: LibraryStatus, type: SeriesType) =>
  STATUS_META[status].label(type);

export const unitLabel = (type: SeriesType) =>
  type === 'anime' ? 'episodios' : 'capítulos';

export const unitName = (type: SeriesType, count: number) => {
  if (type === 'anime') return count === 1 ? 'episodio' : 'episodios';
  return count === 1 ? 'capítulo' : 'capítulos';
};

export const progressPercent = (progress: number, total: number | null) => {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((progress / total) * 100));
};
