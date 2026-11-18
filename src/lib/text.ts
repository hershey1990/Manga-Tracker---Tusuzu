/**
 * Normalizes a title for matching across providers and the Obsidian vault.
 * Keeps unicode letters but drops punctuation, spacing and case differences.
 */
export const normalizeTitle = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const slugify = (value: string): string =>
  normalizeTitle(value).replace(/\s+/g, '-');

export const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

export const formatDate = (value: Date | null | undefined): string => {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
  }).format(value);
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, code: string) => {
      if (code.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
