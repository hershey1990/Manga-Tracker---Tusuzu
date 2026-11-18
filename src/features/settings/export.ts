import type { LibraryItem } from '../library/queries';

const COLUMNS = [
  'title',
  'type',
  'status',
  'progress',
  'total_units',
  'score',
  'favorite',
  'year',
  'notes',
  'source_url',
  'updated_at',
] as const;

const escapeCell = (value: unknown): string => {
  if (value == null) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const toCsv = (items: LibraryItem[]): string => {
  const rows = items.map((item) =>
    [
      item.title,
      item.type,
      item.status,
      item.progress,
      item.totalUnits,
      item.score,
      item.isFavorite ? 'true' : 'false',
      item.year,
      item.notes,
      item.sourceUrl,
      item.updatedAt.toISOString(),
    ]
      .map(escapeCell)
      .join(','),
  );
  return [COLUMNS.join(','), ...rows].join('\r\n');
};

export const toJsonExport = (items: LibraryItem[]) => ({
  app: 'tsuzuku',
  version: 1,
  exportedAt: new Date().toISOString(),
  count: items.length,
  entries: items.map((item) => ({
    title: item.title,
    type: item.type,
    status: item.status,
    progress: item.progress,
    totalUnits: item.totalUnits,
    score: item.score,
    favorite: item.isFavorite,
    year: item.year,
    notes: item.notes,
    sourceUrl: item.sourceUrl,
    updatedAt: item.updatedAt.toISOString(),
  })),
});
