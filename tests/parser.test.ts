import { describe, expect, it } from 'vitest';
import {
  mapVaultStatus,
  parseFrontmatter,
  parseVaultNote,
  vaultExportSchema,
} from '../src/features/import/parser';

const note = (frontmatter: string, body = '') =>
  `---\n${frontmatter}\n---\n\n# Título\n${body}`;

describe('parseFrontmatter', () => {
  it('parses the vault schema including quoted and inline values', () => {
    const parsed = parseFrontmatter(
      note(
        'chapter: 9\nstatus: Pendiente\nurl: "https://example.com/x"\nimage: ""\nnotes: "linea uno"\ntags: [manga, romance]',
      ),
    );

    expect(parsed.chapter).toBe(9);
    expect(parsed.status).toBe('Pendiente');
    expect(parsed.url).toBe('https://example.com/x');
    expect(parsed.image).toBe('');
    expect(parsed.tags).toEqual(['manga', 'romance']);
  });

  it('returns an empty object without frontmatter', () => {
    expect(parseFrontmatter('# Solo cuerpo\n')).toEqual({});
  });
});

describe('mapVaultStatus', () => {
  it('normalizes the documented vocabulary', () => {
    expect(mapVaultStatus('Pendiente').status).toBe('planning');
    expect(mapVaultStatus('Por leer').status).toBe('planning');
    expect(mapVaultStatus('Leyendo').status).toBe('in_progress');
    expect(mapVaultStatus('Finalizado').status).toBe('completed');
  });

  it('warns instead of failing on unknown statuses', () => {
    const result = mapVaultStatus('Terminado');
    expect(result.status).toBe('planning');
    expect(result.warning).toContain('Terminado');
  });
});

describe('parseVaultNote', () => {
  it('uses the filename as the title and keeps progress, notes and url', () => {
    const record = parseVaultNote(
      'A Bad Relationship.md',
      note(
        'chapter: 9\nstatus: Leyendo\nurl: "https://example.com"\nimage: ""\nnotes: "me gusta"\ntags: [manga]',
      ),
    );

    expect(record.title).toBe('A Bad Relationship');
    expect(record.chapter).toBe(9);
    expect(record.status).toBe('in_progress');
    expect(record.url).toBe('https://example.com');
    expect(record.image).toBeNull();
    expect(record.notes).toBe('me gusta');
  });

  it('cleans separators from filename-derived titles', () => {
    const record = parseVaultNote(
      '¡¿Dónde está mi martillo_!.md',
      note('status: Pendiente'),
    );
    expect(record.title).toBe('¡¿Dónde está mi martillo!');
  });

  it('falls back to 0 and warns when chapter is invalid', () => {
    const record = parseVaultNote(
      'X.md',
      note('chapter: abc\nstatus: Leyendo'),
    );
    expect(record.chapter).toBe(0);
    expect(record.warnings.join(' ')).toContain('abc');
  });

  it('validates a full export payload', () => {
    const parsed = vaultExportSchema.safeParse([
      {
        file: 'X.md',
        title: 'X',
        type: 'manga',
        chapter: 1,
        status: 'planning',
        url: null,
        image: null,
        notes: null,
        warnings: [],
      },
    ]);
    expect(parsed.success).toBe(true);
  });
});
