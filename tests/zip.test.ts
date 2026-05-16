import { describe, it, expect } from 'vitest';
import { safeFilename, safeFolderName, joinPath } from '../src/content/downloader/zip';

describe('safeFilename', () => {
  it('replaces forbidden characters with underscore', () => {
    expect(safeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });
  it('strips control characters', () => {
    expect(safeFilename('hello\x08world')).toBe('helloworld');
  });
  it('trims trailing dots and spaces (Windows reserved)', () => {
    expect(safeFilename('hello. ')).toBe('hello');
  });
  it('preserves extension when truncating long names', () => {
    const long = 'x'.repeat(300) + '.pdf';
    const result = safeFilename(long);
    expect(result.endsWith('.pdf')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(200);
  });
  it('returns "_" for empty input', () => {
    expect(safeFilename('')).toBe('_');
    expect(safeFilename('...')).toBe('_');
  });
});

describe('safeFolderName', () => {
  it('replaces slashes and forbidden characters', () => {
    expect(safeFolderName('Week 1 / Intro')).toBe('Week 1 _ Intro');
  });
});

describe('joinPath', () => {
  it('joins path segments with forward slashes', () => {
    expect(joinPath('a', 'b', 'c.txt')).toBe('a/b/c.txt');
  });
  it('trims leading/trailing slashes in segments', () => {
    expect(joinPath('/a/', '/b/', 'c')).toBe('a/b/c');
  });
});
