import { z } from 'zod';
import { type LibraryStatus, libraryStatusSchema } from '../series/schema';

const FRONTMATTER_PATTERN = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/;

type FrontmatterValue = string | number | string[] | null;

const parseScalar = (raw: string): FrontmatterValue => {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((part) => unquote(part))
      .filter((part) => part.length > 0);
  }

  if (value === 'true') return 'true';
  if (value === 'false') return 'false';

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return unquote(value);
};

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

export const parseFrontmatter = (
  markdown: string,
): Record<string, FrontmatterValue> => {
  const match = FRONTMATTER_PATTERN.exec(markdown);
  if (!match?.[1]) return {};

  const result: Record<string, FrontmatterValue> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!key || key.startsWith('#')) continue;
    result[key] = parseScalar(line.slice(separator + 1));
  }
  return result;
};

export const VAULT_STATUS_MAP: Record<string, LibraryStatus> = {
  pendiente: 'planning',
  'por leer': 'planning',
  leyendo: 'in_progress',
  viendo: 'in_progress',
  finalizado: 'completed',
  completado: 'completed',
  'en pausa': 'paused',
  pausado: 'paused',
  abandonado: 'dropped',
  dropeado: 'dropped',
};

export const mapVaultStatus = (
  raw: string | undefined,
): { status: LibraryStatus; warning: string | null } => {
  const normalized = (raw ?? '').trim().toLowerCase();
  if (!normalized) {
    return { status: 'planning', warning: 'Sin estado: se asumió Pendiente' };
  }
  const status = VAULT_STATUS_MAP[normalized];
  if (!status) {
    return {
      status: 'planning',
      warning: `Estado desconocido "${raw}": se asumió Pendiente`,
    };
  }
  return { status, warning: null };
};

const asString = (value: FrontmatterValue | undefined): string => {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

export type VaultRecord = {
  file: string;
  title: string;
  type: 'manga' | 'anime';
  chapter: number;
  status: LibraryStatus;
  url: string | null;
  image: string | null;
  notes: string | null;
  warnings: string[];
};

export const parseVaultNote = (file: string, markdown: string): VaultRecord => {
  const data = parseFrontmatter(markdown);
  const fallbackTitle = file
    .replace(/\.md$/i, '')
    .split(/[\\/]/)
    .pop()!
    .replace(/_/g, ' ')
    .replace(/\s+([!?.,;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const title = asString(data.title).trim() || fallbackTitle;
  const { status, warning } = mapVaultStatus(asString(data.status));
  const chapterRaw = asString(data.chapter);
  const chapter = Number.parseInt(chapterRaw, 10);
  const warnings: string[] = [];
  if (warning) warnings.push(warning);
  if (chapterRaw && (!Number.isFinite(chapter) || chapter < 0)) {
    warnings.push(`Capítulo inválido "${chapterRaw}": se usó 0`);
  }

  const url = asString(data.url).trim();
  const image = asString(data.image).trim();
  const notes = asString(data.notes).trim();

  return {
    file,
    title,
    type: 'manga',
    chapter: Number.isFinite(chapter) && chapter > 0 ? chapter : 0,
    status,
    url: url.length > 0 ? url : null,
    image: image.length > 0 ? image : null,
    notes: notes.length > 0 ? notes : null,
    warnings,
  };
};

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => value ?? null);

export const vaultRecordSchema = z.object({
  file: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  type: z.enum(['manga', 'anime']).default('manga'),
  chapter: z.coerce.number().int().min(0).max(100000).default(0),
  status: libraryStatusSchema.default('planning'),
  url: nullableString,
  image: nullableString,
  notes: nullableString,
  warnings: z.array(z.string()).default([]),
});

export const vaultExportSchema = z.array(vaultRecordSchema).min(1).max(5000);

export type VaultExport = z.infer<typeof vaultExportSchema>;
