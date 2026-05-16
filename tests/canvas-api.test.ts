import { describe, it, expect } from 'vitest';
import { parseNextLink, fetchAllPages } from '../src/lib/canvas-api';

describe('parseNextLink', () => {
  it('extracts the next URL from a Canvas Link header', () => {
    const header = '<https://canvas.example.com/api/v1/items?page=1>; rel="current",<https://canvas.example.com/api/v1/items?page=2>; rel="next",<https://canvas.example.com/api/v1/items?page=10>; rel="last"';
    expect(parseNextLink(header)).toBe('https://canvas.example.com/api/v1/items?page=2');
  });

  it('returns null when no next link is present', () => {
    const header = '<https://canvas.example.com/api/v1/items?page=10>; rel="current",<https://canvas.example.com/api/v1/items?page=10>; rel="last"';
    expect(parseNextLink(header)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseNextLink('')).toBeNull();
    expect(parseNextLink(null)).toBeNull();
  });
});

describe('fetchAllPages', () => {
  it('follows rel=next until exhausted and concatenates results', async () => {
    const responses = new Map<string, { body: any[]; next: string | null }>([
      ['/api/v1/things?per_page=2', { body: [1, 2], next: '/api/v1/things?per_page=2&page=2' }],
      ['/api/v1/things?per_page=2&page=2', { body: [3, 4], next: '/api/v1/things?per_page=2&page=3' }],
      ['/api/v1/things?per_page=2&page=3', { body: [5], next: null }]
    ]);

    const fakeFetch = async (url: string) => {
      const r = responses.get(url);
      if (!r) throw new Error('unexpected url ' + url);
      return new Response(JSON.stringify(r.body), {
        headers: r.next ? { Link: `<${r.next}>; rel="next"` } : {}
      });
    };

    const result = await fetchAllPages<number>('/api/v1/things?per_page=2', { fetch: fakeFetch });
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns single page when no Link header', async () => {
    const fakeFetch = async () => new Response(JSON.stringify([42]));
    const result = await fetchAllPages<number>('/api/v1/x', { fetch: fakeFetch });
    expect(result).toEqual([42]);
  });
});
