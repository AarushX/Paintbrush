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
