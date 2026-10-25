/**
 * Unit tests for src/lib/csv.ts
 * Verifies CSV formula injection protection.
 */

import { describe, it, expect } from 'vitest';
import { csvCell, toCsv } from '../lib/csv';

describe('csvCell', () => {
  it('wraps plain values in double quotes', () => {
    expect(csvCell('hello')).toBe('"hello"');
  });

  it('doubles internal quotes (RFC 4180)', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('guards formula starting with =', () => {
    expect(csvCell('=HYPERLINK("http://evil","click")')).toMatch(/^"'/);
  });

  it('guards formula starting with +', () => {
    expect(csvCell('+1234')).toMatch(/^"'/);
  });

  it('guards formula starting with -', () => {
    expect(csvCell('-1234')).toMatch(/^"'/);
  });

  it('guards formula starting with @', () => {
    expect(csvCell('@SUM')).toMatch(/^"'/);
  });

  it('guards tab-prefixed values', () => {
    expect(csvCell('\t=cmd')).toMatch(/^"'/);
  });

  it('does not guard normal numeric strings', () => {
    expect(csvCell('1234')).toBe('"1234"');
  });
});

describe('toCsv', () => {
  it('produces RFC 4180 CSV (a leading + is formula-guarded like = - @)', () => {
    const result = toCsv(['Name', 'Phone'], [['Alice', '+1234567890']]);
    expect(result).toBe('"Name","Phone"\r\n"Alice","\'+1234567890"');
  });

  it('sanitizes formula injection in rows', () => {
    const result = toCsv(['Name'], [['=EVIL()']]);
    expect(result).toContain("'=EVIL()");
  });
});
