import { describe, expect, it } from 'vitest';
import { normalizeTitle, stripHtml, truncate } from '../src/lib/text';

describe('normalizeTitle', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalizeTitle('  ¡¿Dónde está mi martillo!? ')).toBe(
      'donde esta mi martillo',
    );
    expect(normalizeTitle('Sousou no Frieren')).toBe('sousou no frieren');
  });

  it('collapses separators so provider and vault titles match', () => {
    expect(normalizeTitle('Kimi no Na wa.')).toBe(
      normalizeTitle('kimi no na wa'),
    );
  });
});

describe('stripHtml', () => {
  it('removes tags and decodes common entities', () => {
    expect(stripHtml('<p>One &amp; two<br/>three</p><script>x</script>')).toBe(
      'One & two threex',
    );
  });
});

describe('truncate', () => {
  it('keeps short values and shortens long ones', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('a long value here', 8)).toBe('a long…');
  });
});
