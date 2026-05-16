import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToMarkdown, extractCanvasFileRefs } from '../src/content/downloader/markdown';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');

describe('htmlToMarkdown', () => {
  it('converts basic Canvas page HTML to Markdown', () => {
    const md = htmlToMarkdown(fixture('canvas-page-basic.html'));
    expect(md).toContain('# Lecture 3');
    expect(md).toMatch(/\*\*trees\*\*/);
    expect(md).toMatch(/- BSTs/);
    expect(md).toContain('```');
    expect(md).toContain('function insert(node) {}');
  });

  it('unwraps the .user_content div without leaving a stray opening tag', () => {
    const md = htmlToMarkdown(fixture('canvas-page-basic.html'));
    expect(md).not.toContain('user_content');
  });

  it('replaces unsupported embeds with a fallback link', () => {
    const html = '<p>Watch: <iframe src="https://kaltura.example.com/v/123"></iframe></p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('[Embedded content — view on Canvas]');
    expect(md).toContain('https://kaltura.example.com/v/123');
  });
});

describe('extractCanvasFileRefs', () => {
  it('finds file IDs in href and src attributes', () => {
    const refs = extractCanvasFileRefs(fixture('canvas-page-with-files.html'));
    expect(refs.map(r => r.fileId).sort()).toEqual([456, 789]);
  });

  it('returns the original URL for rewriting later', () => {
    const refs = extractCanvasFileRefs(fixture('canvas-page-with-files.html'));
    expect(refs[0]?.originalUrl).toContain('/files/456');
  });

  it('returns empty array when no Canvas file links', () => {
    expect(extractCanvasFileRefs('<p>no files here</p>')).toEqual([]);
  });
});
