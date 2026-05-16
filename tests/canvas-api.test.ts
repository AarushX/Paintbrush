import { describe, it, expect } from 'vitest';
import { parseNextLink, fetchAllPages, fetchWithRetry, readCsrfToken } from '../src/lib/canvas-api';

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

    const fakeFetch = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
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

describe('fetchWithRetry', () => {
  it('retries on network error up to 3 times then succeeds', async () => {
    let calls = 0;
    const fakeFetch = async () => {
      calls++;
      if (calls < 3) throw new TypeError('Failed to fetch');
      return new Response('ok', { status: 200 });
    };
    const res = await fetchWithRetry('/x', { fetch: fakeFetch, baseDelayMs: 0 });
    expect(res.status).toBe(200);
    expect(calls).toBe(3);
  });

  it('respects Retry-After header on 429', async () => {
    let calls = 0;
    const delays: number[] = [];
    const fakeFetch = async () => {
      calls++;
      if (calls === 1) {
        return new Response('rate limited', { status: 429, headers: { 'Retry-After': '1' } });
      }
      return new Response('ok', { status: 200 });
    };
    const fakeSleep = (ms: number) => { delays.push(ms); return Promise.resolve(); };
    const res = await fetchWithRetry('/x', { fetch: fakeFetch, baseDelayMs: 0, sleep: fakeSleep });
    expect(res.status).toBe(200);
    expect(delays).toEqual([1000]);
  });

  it('gives up after maxRetries and throws', async () => {
    const fakeFetch = async () => { throw new TypeError('fail'); };
    await expect(
      fetchWithRetry('/x', { fetch: fakeFetch, baseDelayMs: 0, maxRetries: 2 })
    ).rejects.toThrow();
  });
});

describe('readCsrfToken', () => {
  it('extracts URL-encoded _csrf_token cookie value', () => {
    const cookie = 'log_session_id=abc; _csrf_token=raw%2Btoken%3Dvalue; other=x';
    expect(readCsrfToken(cookie)).toBe('raw+token=value');
  });
  it('returns null when token cookie is missing', () => {
    expect(readCsrfToken('other=x; another=y')).toBeNull();
  });
});
