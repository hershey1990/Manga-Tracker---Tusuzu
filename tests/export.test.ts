import { describe, expect, it } from 'vitest';
import type { LibraryItem } from '../src/features/library/queries';
import { toCsv, toJsonExport } from '../src/features/settings/export';

const item = (overrides: Partial<LibraryItem> = {}): LibraryItem => ({
  entryId: 'entry-1',
  seriesId: 'series-1',
  type: 'manga',
  title: 'Frieren, Beyond "Journey"',
  coverImage: null,
  status: 'in_progress',
  progress: 12,
  totalUnits: 140,
  score: 9,
  notes: 'linea 1\nlinea 2',
  isFavorite: true,
  year: 2020,
  providerStatus: 'RELEASING',
  sourceUrl: 'https://anilist.co/manga/1',
  updatedAt: new Date('2026-01-02T03:04:05.000Z'),
  ...overrides,
});

describe('toCsv', () => {
  it('escapes commas, quotes and newlines', () => {
    const csv = toCsv([item()]);
    const lines = csv.split('\r\n');

    expect(lines[0]).toContain('title,type,status');
    expect(lines[1]).toContain('"Frieren, Beyond ""Journey"""');
    expect(lines[1]).toContain('"linea 1\nlinea 2"');
    expect(lines[1]).toContain('true');
  });

  it('keeps empty values for null fields', () => {
    const csv = toCsv([item({ score: null, year: null, notes: null })]);
    expect(csv).toContain(',manga,in_progress,12,140,,true,');
  });
});

describe('toJsonExport', () => {
  it('serializes a portable snapshot', () => {
    const snapshot = toJsonExport([item()]);
    expect(snapshot.version).toBe(1);
    expect(snapshot.count).toBe(1);
    expect(snapshot.entries[0]).toMatchObject({
      title: 'Frieren, Beyond "Journey"',
      progress: 12,
      totalUnits: 140,
      score: 9,
      favorite: true,
    });
  });
});
