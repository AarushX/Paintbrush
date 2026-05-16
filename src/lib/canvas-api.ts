export function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(',');
  for (const part of parts) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1] ?? null;
  }
  return null;
}

export interface FetchOptions {
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

export async function fetchAllPages<T>(
  initialUrl: string,
  options: FetchOptions = {}
): Promise<T[]> {
  const f = options.fetch ?? globalThis.fetch.bind(globalThis);
  const out: T[] = [];
  let url: string | null = initialUrl;
  while (url) {
    const res: Response = await f(url, { signal: options.signal, credentials: 'include' });
    if (!res.ok) throw new CanvasApiError(`${res.status} ${res.statusText} on ${url}`, res.status);
    const page = (await res.json()) as T[];
    out.push(...page);
    url = parseNextLink(res.headers.get('Link'));
  }
  return out;
}

export class CanvasApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'CanvasApiError';
  }
}

export interface RetryOptions extends FetchOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchWithRetry(url: string, options: RetryOptions = {}): Promise<Response> {
  const f = options.fetch ?? globalThis.fetch.bind(globalThis);
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelayMs ?? 250;
  const sleep = options.sleep ?? defaultSleep;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await f(url, { signal: options.signal, credentials: 'include' });
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const wait = retryAfter ? Number(retryAfter) * 1000 : baseDelay * 2 ** attempt;
        if (attempt === maxRetries) return res;
        await sleep(wait);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries) break;
      await sleep(baseDelay * 2 ** attempt);
    }
  }
  throw lastErr ?? new Error('fetchWithRetry: exhausted retries');
}

export function readCsrfToken(cookieString: string): string | null {
  const parts = cookieString.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=');
    if (name === '_csrf_token') {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export async function canvasPost<T>(url: string, body: unknown, options: FetchOptions = {}): Promise<T> {
  const f = options.fetch ?? globalThis.fetch.bind(globalThis);
  const csrf = typeof document !== 'undefined' ? readCsrfToken(document.cookie) : null;
  const res = await f(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {})
    },
    body: JSON.stringify(body),
    signal: options.signal
  });
  if (!res.ok) throw new CanvasApiError(`${res.status} ${res.statusText} on ${url}`, res.status);
  return (await res.json()) as T;
}
