# Paintbrush — Canvas Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that pins a Canvas planner-items sidebar onto every Canvas page and adds bulk "Download all files" and "Export modules" buttons that produce ZIPs.

**Architecture:** Content-script-first. All Canvas API access happens from the page (same-origin, session-cookie auth). The service worker is minimal — only handles toolbar action clicks. The sidebar mounts inside a shadow DOM so Canvas's CSS can't leak in. ZIP building happens in the page so it can't be killed by service-worker eviction.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vite + `@crxjs/vite-plugin`, Tailwind CSS, JSZip, Turndown, Vitest.

**Spec:** [docs/superpowers/specs/2026-05-15-paintbrush-canvas-extension-design.md](../specs/2026-05-15-paintbrush-canvas-extension-design.md)

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

Create `package.json`:

```json
{
  "name": "paintbrush",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "@tsconfig/svelte": "^5.0.4",
    "@types/chrome": "^0.0.270",
    "@types/turndown": "^5.0.5",
    "autoprefixer": "^10.4.20",
    "happy-dom": "^15.0.0",
    "postcss": "^8.4.49",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "tailwindcss": "^3.4.14",
    "tslib": "^2.8.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "jszip": "^3.10.1",
    "turndown": "^7.2.0",
    "turndown-plugin-gfm": "^1.0.2"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install
```

Expected: deps install without errors, `node_modules/` created.

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": false,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "svelte", "vitest/globals"],
    "baseUrl": ".",
    "paths": {
      "$lib/*": ["src/lib/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "tests/**/*.ts"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

export default defineConfig({
  plugins: [svelte(), crx({ manifest })],
  resolve: {
    alias: { $lib: '/src/lib' }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts']
  }
});
```

- [ ] **Step 5: Create tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{svelte,ts,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
```

- [ ] **Step 6: Create postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
dist/
.DS_Store
*.log
.vite/
coverage/
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts tailwind.config.js postcss.config.js .gitignore
git commit -m "chore: scaffold Svelte 5 + Vite + Tailwind + crxjs project"
```

---

## Task 2: Manifest and entry stubs

**Files:**
- Create: `manifest.json`
- Create: `src/content/index.ts`
- Create: `src/background/service-worker.ts`
- Create: `src/styles/tailwind.css`
- Create: `public/icons/icon-16.png` (placeholder), `icon-32.png`, `icon-48.png`, `icon-128.png`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Paintbrush for Canvas",
  "version": "0.1.0",
  "description": "Todos sidebar and bulk download for Canvas LMS.",
  "permissions": ["storage", "scripting"],
  "host_permissions": ["*://*.instructure.com/*"],
  "optional_host_permissions": ["*://*/*"],
  "icons": {
    "16": "public/icons/icon-16.png",
    "32": "public/icons/icon-32.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  },
  "action": {
    "default_title": "Toggle Paintbrush sidebar",
    "default_icon": {
      "16": "public/icons/icon-16.png",
      "32": "public/icons/icon-32.png"
    }
  },
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["*://*.instructure.com/*"],
      "js": ["src/content/index.ts"],
      "run_at": "document_idle"
    }
  ],
  "options_page": "src/options/index.html"
}
```

- [ ] **Step 2: Create placeholder icons**

```bash
mkdir -p public/icons
for size in 16 32 48 128; do
  # 1x1 transparent PNG as placeholder, base64-decoded
  printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x01\x5c\xcc\xb6\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > "public/icons/icon-${size}.png"
done
```

Expected: four PNG files exist. We'll replace with real icons in Task 17.

- [ ] **Step 3: Create src/styles/tailwind.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Create src/background/service-worker.ts**

```ts
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
  } catch {
    // Content script not loaded on this tab (e.g. chrome:// page) — ignore.
  }
});
```

- [ ] **Step 5: Create src/content/index.ts**

```ts
console.log('[Paintbrush] content script loaded on', location.href);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'TOGGLE_SIDEBAR') {
    console.log('[Paintbrush] toggle sidebar requested');
  }
});
```

- [ ] **Step 6: Verify the build works**

Run:
```bash
npm run build
```

Expected: builds to `dist/`, no errors. `dist/manifest.json` exists.

- [ ] **Step 7: Commit**

```bash
git add manifest.json src/ public/
git commit -m "feat: add MV3 manifest, content + background entry stubs"
```

---

## Task 3: Canvas API client — pagination

**Files:**
- Create: `src/lib/canvas-api.ts`
- Create: `src/lib/types.ts`
- Create: `tests/canvas-api.test.ts`

- [ ] **Step 1: Define core types in src/lib/types.ts**

```ts
export interface PlannerItem {
  plannable_id: number;
  plannable_type: 'assignment' | 'quiz' | 'discussion_topic' | 'planner_note' | 'announcement' | 'wiki_page' | 'calendar_event';
  plannable_date: string; // ISO
  plannable: {
    title?: string;
    name?: string;
    points_possible?: number;
    due_at?: string | null;
  };
  course_id: number | null;
  context_name: string | null;
  html_url: string;
  planner_override?: {
    id: number;
    marked_complete: boolean;
  } | null;
}

export interface CourseColors {
  custom_colors: Record<string, string>; // { "course_123": "#abc123" }
}

export interface Course {
  id: number;
  name: string;
  course_code: string;
}

export interface Folder {
  id: number;
  name: string;
  full_name: string; // "course files/Lectures/Week 1"
  parent_folder_id: number | null;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  folder_id: number;
}

export interface Module {
  id: number;
  name: string;
  position: number;
  items: ModuleItem[];
}

export interface ModuleItem {
  id: number;
  title: string;
  position: number;
  type: 'File' | 'Page' | 'Assignment' | 'Quiz' | 'Discussion' | 'ExternalUrl' | 'ExternalTool' | 'SubHeader';
  content_id?: number;
  page_url?: string;
  external_url?: string;
  html_url?: string;
}

export interface Page {
  page_id: number;
  title: string;
  url: string;
  body: string; // HTML
  updated_at: string;
  html_url: string;
}

export interface Assignment {
  id: number;
  name: string;
  description: string | null; // HTML
  due_at: string | null;
  points_possible: number;
  submission_types: string[];
  html_url: string;
}
```

- [ ] **Step 2: Write failing test for Link-header pagination parser**

Create `tests/canvas-api.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseNextLink } from '../src/lib/canvas-api';

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
```

- [ ] **Step 3: Run test, verify it fails**

Run:
```bash
npm test -- canvas-api
```

Expected: FAIL — `parseNextLink is not a function`.

- [ ] **Step 4: Implement parseNextLink in src/lib/canvas-api.ts**

```ts
export function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(',');
  for (const part of parts) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1] ?? null;
  }
  return null;
}
```

- [ ] **Step 5: Run test, verify it passes**

Run:
```bash
npm test -- canvas-api
```

Expected: PASS.

- [ ] **Step 6: Write failing test for paginated fetcher**

Append to `tests/canvas-api.test.ts`:

```ts
import { fetchAllPages } from '../src/lib/canvas-api';

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
```

- [ ] **Step 7: Run test, verify it fails**

Expected: FAIL — `fetchAllPages is not a function`.

- [ ] **Step 8: Implement fetchAllPages**

Append to `src/lib/canvas-api.ts`:

```ts
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
```

- [ ] **Step 9: Run tests, verify they pass**

Run:
```bash
npm test -- canvas-api
```

Expected: PASS (5 tests).

- [ ] **Step 10: Commit**

```bash
git add src/lib/types.ts src/lib/canvas-api.ts tests/canvas-api.test.ts
git commit -m "feat(api): add Canvas API client with Link-header pagination"
```

---

## Task 4: Canvas API client — retry + CSRF

**Files:**
- Modify: `src/lib/canvas-api.ts`
- Modify: `tests/canvas-api.test.ts`

- [ ] **Step 1: Write failing test for retry with backoff**

Append to `tests/canvas-api.test.ts`:

```ts
import { fetchWithRetry } from '../src/lib/canvas-api';

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
```

- [ ] **Step 2: Run test, verify it fails**

Expected: FAIL — `fetchWithRetry is not a function`.

- [ ] **Step 3: Implement fetchWithRetry**

Append to `src/lib/canvas-api.ts`:

```ts
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
```

- [ ] **Step 4: Run tests, verify they pass**

Run:
```bash
npm test -- canvas-api
```

Expected: PASS.

- [ ] **Step 5: Write failing test for CSRF token reading**

Append to `tests/canvas-api.test.ts`:

```ts
import { readCsrfToken } from '../src/lib/canvas-api';

describe('readCsrfToken', () => {
  it('extracts URL-encoded _csrf_token cookie value', () => {
    const cookie = 'log_session_id=abc; _csrf_token=raw%2Btoken%3Dvalue; other=x';
    expect(readCsrfToken(cookie)).toBe('raw+token=value');
  });
  it('returns null when token cookie is missing', () => {
    expect(readCsrfToken('other=x; another=y')).toBeNull();
  });
});
```

- [ ] **Step 6: Run test, verify it fails**

Expected: FAIL.

- [ ] **Step 7: Implement readCsrfToken**

Append to `src/lib/canvas-api.ts`:

```ts
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
```

- [ ] **Step 8: Run tests, verify they pass**

Run:
```bash
npm test -- canvas-api
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/canvas-api.ts tests/canvas-api.test.ts
git commit -m "feat(api): add retry/backoff and CSRF-aware POST helper"
```

---

## Task 5: Storage and course-context helpers

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/lib/course-context.ts`
- Create: `tests/course-context.test.ts`

- [ ] **Step 1: Create src/lib/storage.ts**

```ts
export interface LocalStorageShape {
  sidebarDefaultOpen: boolean;
  customDomains: string[];
  courseColors: Record<string, string>;
  courseColorsFetchedAt: number;
}

const DEFAULTS: LocalStorageShape = {
  sidebarDefaultOpen: true,
  customDomains: [],
  courseColors: {},
  courseColorsFetchedAt: 0
};

export async function getLocal<K extends keyof LocalStorageShape>(key: K): Promise<LocalStorageShape[K]> {
  const result = await chrome.storage.local.get(key);
  return (result[key] ?? DEFAULTS[key]) as LocalStorageShape[K];
}

export async function setLocal<K extends keyof LocalStorageShape>(key: K, value: LocalStorageShape[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export interface SessionStorageShape {
  plannerCache: { items: unknown[]; fetchedAt: number } | null;
}

export async function getSession<K extends keyof SessionStorageShape>(key: K): Promise<SessionStorageShape[K]> {
  const result = await chrome.storage.session.get(key);
  return (result[key] ?? null) as SessionStorageShape[K];
}

export async function setSession<K extends keyof SessionStorageShape>(key: K, value: SessionStorageShape[K]): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}
```

- [ ] **Step 2: Write failing test for course-context URL parsing**

Create `tests/course-context.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCourseFromUrl } from '../src/lib/course-context';

describe('parseCourseFromUrl', () => {
  it('extracts course id from /courses/:id', () => {
    expect(parseCourseFromUrl('https://canvas.example.com/courses/1234')).toBe(1234);
  });
  it('extracts course id from /courses/:id/files', () => {
    expect(parseCourseFromUrl('https://canvas.example.com/courses/1234/files')).toBe(1234);
  });
  it('extracts course id from /courses/:id/modules?foo=1', () => {
    expect(parseCourseFromUrl('https://canvas.example.com/courses/567/modules?foo=1')).toBe(567);
  });
  it('returns null when no course in URL', () => {
    expect(parseCourseFromUrl('https://canvas.example.com/profile')).toBeNull();
  });
  it('returns null for non-numeric course segment', () => {
    expect(parseCourseFromUrl('https://canvas.example.com/courses/abc')).toBeNull();
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run:
```bash
npm test -- course-context
```

Expected: FAIL.

- [ ] **Step 4: Implement src/lib/course-context.ts**

```ts
export function parseCourseFromUrl(url: string): number | null {
  const m = url.match(/\/courses\/(\d+)(?:\/|\?|$)/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}

export function isFilesPage(url: string): boolean {
  return /\/courses\/\d+\/files(\b|\/|\?)/.test(url);
}

export function isModulesPage(url: string): boolean {
  return /\/courses\/\d+\/modules(\b|\/|\?)/.test(url);
}
```

- [ ] **Step 5: Add tests for page-type detection**

Append to `tests/course-context.test.ts`:

```ts
import { isFilesPage, isModulesPage } from '../src/lib/course-context';

describe('isFilesPage', () => {
  it('matches /courses/:id/files and subpaths', () => {
    expect(isFilesPage('https://x/courses/1/files')).toBe(true);
    expect(isFilesPage('https://x/courses/1/files/folder/Lectures')).toBe(true);
    expect(isFilesPage('https://x/courses/1/modules')).toBe(false);
  });
});

describe('isModulesPage', () => {
  it('matches /courses/:id/modules and subpaths', () => {
    expect(isModulesPage('https://x/courses/1/modules')).toBe(true);
    expect(isModulesPage('https://x/courses/1/modules?include=items')).toBe(true);
    expect(isModulesPage('https://x/courses/1/files')).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests, verify they pass**

Run:
```bash
npm test -- course-context
```

Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/storage.ts src/lib/course-context.ts tests/course-context.test.ts
git commit -m "feat(lib): add storage helpers and course-context URL parsing"
```

---

## Task 6: Filename slugifier and ZIP wrapper

**Files:**
- Create: `src/content/downloader/zip.ts`
- Create: `tests/zip.test.ts`

- [ ] **Step 1: Write failing tests for slugifier**

Create `tests/zip.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { safeFilename, safeFolderName, joinPath } from '../src/content/downloader/zip';

describe('safeFilename', () => {
  it('replaces forbidden characters with underscore', () => {
    expect(safeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });
  it('strips control characters', () => {
    expect(safeFilename('hello world')).toBe('helloworld');
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run:
```bash
npm test -- zip
```

Expected: FAIL.

- [ ] **Step 3: Implement src/content/downloader/zip.ts**

```ts
import JSZip from 'jszip';

const FORBIDDEN = /[\/\\:*?"<>|]/g;
const CONTROL = /[\x00-\x1f\x7f]/g;
const MAX_LEN = 200;

export function safeFilename(name: string): string {
  let s = name.replace(CONTROL, '').replace(FORBIDDEN, '_');
  s = s.replace(/[.\s]+$/g, '');
  if (!s) return '_';
  if (s.length > MAX_LEN) {
    const dot = s.lastIndexOf('.');
    if (dot > 0 && s.length - dot <= 10) {
      const ext = s.slice(dot);
      s = s.slice(0, MAX_LEN - ext.length) + ext;
    } else {
      s = s.slice(0, MAX_LEN);
    }
  }
  return s;
}

export function safeFolderName(name: string): string {
  return safeFilename(name);
}

export function joinPath(...segments: string[]): string {
  return segments
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .filter((s) => s.length > 0)
    .join('/');
}

export function createZip(): JSZip {
  return new JSZip();
}

export async function generateZipBlob(zip: JSZip, onProgress?: (percent: number) => void): Promise<Blob> {
  return zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => onProgress?.(meta.percent)
  );
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run:
```bash
npm test -- zip
```

Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/content/downloader/zip.ts tests/zip.test.ts
git commit -m "feat(zip): add filename slugifier and JSZip wrapper"
```

---

## Task 7: HTML → Markdown converter

**Files:**
- Create: `src/content/downloader/markdown.ts`
- Create: `tests/markdown.test.ts`
- Create: `tests/fixtures/canvas-page-basic.html`
- Create: `tests/fixtures/canvas-page-with-files.html`

- [ ] **Step 1: Create test fixtures**

Create `tests/fixtures/canvas-page-basic.html`:

```html
<div class="user_content"><h1>Lecture 3</h1><p>Welcome to <strong>trees</strong>.</p><ul><li>BSTs</li><li>AVL</li></ul><pre><code>function insert(node) {}</code></pre></div>
```

Create `tests/fixtures/canvas-page-with-files.html`:

```html
<div class="user_content"><p>See the <a href="/courses/123/files/456/download?wrap=1" data-api-endpoint="/api/v1/courses/123/files/456">slides</a> and <img src="/courses/123/files/789/preview" alt="diagram"></p></div>
```

- [ ] **Step 2: Write failing tests for HTML → Markdown**

Create `tests/markdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { htmlToMarkdown, extractCanvasFileRefs } from '../src/content/downloader/markdown';

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
```

- [ ] **Step 3: Run tests, verify they fail**

Run:
```bash
npm test -- markdown
```

Expected: FAIL.

- [ ] **Step 4: Implement src/content/downloader/markdown.ts**

```ts
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export interface CanvasFileRef {
  fileId: number;
  originalUrl: string;
  attribute: 'href' | 'src';
}

const FILE_URL_PATTERN = /\/(?:courses\/\d+\/)?(?:users\/\d+\/)?files\/(\d+)\b/;

export function extractCanvasFileRefs(html: string): CanvasFileRef[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const refs: CanvasFileRef[] = [];
  doc.querySelectorAll('a[href], img[src]').forEach((el) => {
    const attr: 'href' | 'src' = el.tagName === 'IMG' ? 'src' : 'href';
    const value = el.getAttribute(attr);
    if (!value) return;
    const m = value.match(FILE_URL_PATTERN);
    if (m) refs.push({ fileId: Number(m[1]), originalUrl: value, attribute: attr });
  });
  return refs;
}

function preprocessHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Unwrap Canvas's .user_content wrapper
  doc.querySelectorAll('.user_content').forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  // Replace iframes with link fallbacks
  doc.querySelectorAll('iframe').forEach((el) => {
    const src = el.getAttribute('src') ?? '';
    const link = doc.createElement('a');
    link.setAttribute('href', src);
    link.textContent = 'Embedded content — view on Canvas';
    el.parentNode?.replaceChild(link, el);
  });
  return doc.body.innerHTML;
}

let cachedService: TurndownService | null = null;

function getService(): TurndownService {
  if (cachedService) return cachedService;
  const s = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_'
  });
  s.use(gfm);
  cachedService = s;
  return s;
}

export function htmlToMarkdown(html: string): string {
  const pre = preprocessHtml(html);
  return getService().turndown(pre).trim() + '\n';
}

export interface RewriteOptions {
  resolveAssetPath: (fileId: number) => string;
}

export function rewriteCanvasFileLinks(html: string, opts: RewriteOptions): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('a[href], img[src]').forEach((el) => {
    const attr: 'href' | 'src' = el.tagName === 'IMG' ? 'src' : 'href';
    const value = el.getAttribute(attr);
    if (!value) return;
    const m = value.match(FILE_URL_PATTERN);
    if (m) {
      el.setAttribute(attr, opts.resolveAssetPath(Number(m[1])));
    }
  });
  return doc.body.innerHTML;
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run:
```bash
npm test -- markdown
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/content/downloader/markdown.ts tests/markdown.test.ts tests/fixtures/
git commit -m "feat(md): add HTML→Markdown converter with Canvas file link extraction"
```

---

## Task 8: Planner item grouping

**Files:**
- Create: `src/content/sidebar/grouping.ts`
- Create: `tests/grouping.test.ts`

- [ ] **Step 1: Write failing tests for grouping logic**

Create `tests/grouping.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { groupByDueWindow } from '../src/content/sidebar/grouping';
import type { PlannerItem } from '../src/lib/types';

function item(plannable_date: string, marked_complete = false): PlannerItem {
  return {
    plannable_id: 1,
    plannable_type: 'assignment',
    plannable_date,
    plannable: { title: 'X' },
    course_id: 1,
    context_name: 'Course',
    html_url: '/x',
    planner_override: marked_complete ? { id: 1, marked_complete: true } : null
  };
}

describe('groupByDueWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('puts past-due items in overdue', () => {
    const items = [item('2026-05-14T23:59:00Z')];
    expect(groupByDueWindow(items).overdue).toHaveLength(1);
  });

  it('puts today items in today', () => {
    const items = [item('2026-05-15T23:59:00Z')];
    expect(groupByDueWindow(items).today).toHaveLength(1);
  });

  it('puts tomorrow items in tomorrow', () => {
    const items = [item('2026-05-16T10:00:00Z')];
    expect(groupByDueWindow(items).tomorrow).toHaveLength(1);
  });

  it('puts items 2-7 days out in thisWeek', () => {
    const items = [item('2026-05-18T10:00:00Z'), item('2026-05-22T10:00:00Z')];
    expect(groupByDueWindow(items).thisWeek).toHaveLength(2);
  });

  it('puts items beyond 7 days in later', () => {
    const items = [item('2026-05-25T10:00:00Z')];
    expect(groupByDueWindow(items).later).toHaveLength(1);
  });

  it('excludes completed items from overdue', () => {
    const items = [item('2026-05-14T23:59:00Z', true)];
    expect(groupByDueWindow(items).overdue).toHaveLength(0);
  });

  it('sorts each group ascending by due date', () => {
    const items = [
      item('2026-05-18T22:00:00Z'),
      item('2026-05-17T10:00:00Z')
    ];
    const result = groupByDueWindow(items);
    expect(result.thisWeek[0]?.plannable_date).toBe('2026-05-17T10:00:00Z');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run:
```bash
npm test -- grouping
```

Expected: FAIL.

- [ ] **Step 3: Implement src/content/sidebar/grouping.ts**

```ts
import type { PlannerItem } from '../../lib/types';

export interface GroupedItems {
  overdue: PlannerItem[];
  today: PlannerItem[];
  tomorrow: PlannerItem[];
  thisWeek: PlannerItem[];
  later: PlannerItem[];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function groupByDueWindow(items: PlannerItem[], now: Date = new Date()): GroupedItems {
  const out: GroupedItems = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [] };
  for (const it of items) {
    const due = new Date(it.plannable_date);
    const isComplete = !!it.planner_override?.marked_complete;
    const diff = daysBetween(now, due);
    if (due < now && diff < 0 && !isComplete) {
      out.overdue.push(it);
    } else if (diff === 0) {
      out.today.push(it);
    } else if (diff === 1) {
      out.tomorrow.push(it);
    } else if (diff >= 2 && diff <= 7) {
      out.thisWeek.push(it);
    } else if (diff > 7) {
      out.later.push(it);
    }
    // diff < 0 and complete: drop (already done, past)
  }
  const sortAsc = (a: PlannerItem, b: PlannerItem) =>
    new Date(a.plannable_date).getTime() - new Date(b.plannable_date).getTime();
  out.overdue.sort(sortAsc);
  out.today.sort(sortAsc);
  out.tomorrow.sort(sortAsc);
  out.thisWeek.sort(sortAsc);
  out.later.sort(sortAsc);
  return out;
}

export type ItemTypeFilter = 'all' | 'assignment' | 'quiz' | 'discussion_topic' | 'planner_note';

export function filterByType(items: PlannerItem[], filter: ItemTypeFilter): PlannerItem[] {
  if (filter === 'all') return items;
  return items.filter((i) => i.plannable_type === filter);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run:
```bash
npm test -- grouping
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/sidebar/grouping.ts tests/grouping.test.ts
git commit -m "feat(sidebar): add planner item grouping and filter logic"
```

---

## Task 9: Shadow-DOM mount infrastructure

**Files:**
- Create: `src/content/inject/mount.ts`
- Create: `src/content/sidebar/Sidebar.svelte`
- Modify: `src/content/index.ts`

- [ ] **Step 1: Create a minimal Sidebar.svelte placeholder**

Create `src/content/sidebar/Sidebar.svelte`:

```svelte
<script lang="ts">
  let { open = $bindable(true) }: { open?: boolean } = $props();
</script>

<aside class="fixed right-0 top-0 z-[2147483647] h-screen bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-sans transition-transform"
       class:translate-x-0={open}
       class:translate-x-[calc(100%-44px)]={!open}
       style="width: 320px;">
  <header class="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800">
    <h2 class="text-sm font-semibold tracking-tight">Paintbrush</h2>
    <button class="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            onclick={() => open = !open}>
      {open ? 'Hide' : 'Show'}
    </button>
  </header>
  <div class="p-3 text-sm text-zinc-500">Sidebar bootstrapped.</div>
</aside>
```

- [ ] **Step 2: Create src/content/inject/mount.ts**

```ts
import { mount } from 'svelte';
import Sidebar from '../sidebar/Sidebar.svelte';
import tailwindCss from '../../styles/tailwind.css?inline';
import { getLocal } from '../../lib/storage';

const HOST_ID = 'paintbrush-root';

export async function mountSidebar(): Promise<() => void> {
  if (document.getElementById(HOST_ID)) {
    return () => {}; // already mounted
  }

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all: initial; position: fixed; inset: 0 0 auto auto; pointer-events: none; z-index: 2147483647;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = tailwindCss;
  shadow.appendChild(styleEl);

  // Re-enable pointer events inside our UI
  const appRoot = document.createElement('div');
  appRoot.style.cssText = 'pointer-events: auto;';
  shadow.appendChild(appRoot);

  const defaultOpen = await getLocal('sidebarDefaultOpen');
  const app = mount(Sidebar, { target: appRoot, props: { open: defaultOpen } });

  return () => {
    host.remove();
    void app;
  };
}
```

- [ ] **Step 3: Wire mount into content script**

Replace `src/content/index.ts`:

```ts
import { mountSidebar } from './inject/mount';

let unmount: (() => void) | null = null;

async function init() {
  unmount = await mountSidebar();
}

init().catch((err) => console.error('[Paintbrush]', err));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'TOGGLE_SIDEBAR') {
    // The Sidebar component owns open/close. Dispatch a custom event the component listens for.
    document.dispatchEvent(new CustomEvent('paintbrush:toggle'));
  }
});
```

- [ ] **Step 4: Build to verify**

Run:
```bash
npm run build
```

Expected: builds without errors. `dist/` contains the bundled content script and inlined CSS.

- [ ] **Step 5: Manual smoke test**

```
1. Open chrome://extensions, enable Developer mode
2. "Load unpacked" → select dist/
3. Navigate to a Canvas page (any *.instructure.com URL where you're logged in)
4. Confirm: sidebar appears on right edge, says "Paintbrush" and "Sidebar bootstrapped."
5. Confirm: clicking "Hide" / "Show" toggles the panel
6. Confirm: Canvas's own CSS does not bleed into the sidebar (font, colors look like Tailwind defaults)
```

- [ ] **Step 6: Commit**

```bash
git add src/content/inject/ src/content/sidebar/Sidebar.svelte src/content/index.ts
git commit -m "feat(sidebar): shadow-DOM mount with bootstrap Sidebar component"
```

---

## Task 10: Planner API + sidebar state

**Files:**
- Create: `src/content/sidebar/api.ts`
- Create: `src/content/sidebar/stores.svelte.ts`
- Modify: `src/content/sidebar/Sidebar.svelte`

- [ ] **Step 1: Create src/content/sidebar/api.ts**

```ts
import { fetchAllPages, canvasPost } from '../../lib/canvas-api';
import type { PlannerItem, CourseColors } from '../../lib/types';
import { getLocal, setLocal, getSession, setSession } from '../../lib/storage';

const PLANNER_CACHE_TTL_MS = 5 * 60_000;
const COLORS_CACHE_TTL_MS = 24 * 60 * 60_000;

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function fetchPlannerItems(): Promise<PlannerItem[]> {
  const url = `/api/v1/planner/items?start_date=${isoDateOffset(-7)}&end_date=${isoDateOffset(30)}&per_page=50`;
  return fetchAllPages<PlannerItem>(url);
}

export async function getCachedPlannerItems(): Promise<PlannerItem[] | null> {
  const cache = await getSession('plannerCache');
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > PLANNER_CACHE_TTL_MS) return null;
  return cache.items as PlannerItem[];
}

export async function setCachedPlannerItems(items: PlannerItem[]): Promise<void> {
  await setSession('plannerCache', { items, fetchedAt: Date.now() });
}

export async function getCourseColors(): Promise<Record<string, string>> {
  const fetchedAt = await getLocal('courseColorsFetchedAt');
  if (Date.now() - fetchedAt < COLORS_CACHE_TTL_MS) {
    return await getLocal('courseColors');
  }
  const res = await fetch('/api/v1/users/self/colors', { credentials: 'include' });
  if (!res.ok) return await getLocal('courseColors');
  const data = (await res.json()) as CourseColors;
  await setLocal('courseColors', data.custom_colors);
  await setLocal('courseColorsFetchedAt', Date.now());
  return data.custom_colors;
}

export async function markComplete(item: PlannerItem): Promise<void> {
  await canvasPost('/api/v1/planner/overrides', {
    plannable_type: item.plannable_type,
    plannable_id: item.plannable_id,
    marked_complete: true
  });
}
```

- [ ] **Step 2: Create src/content/sidebar/stores.svelte.ts**

```ts
import type { PlannerItem } from '../../lib/types';
import { fetchPlannerItems, getCachedPlannerItems, setCachedPlannerItems, getCourseColors } from './api';
import { groupByDueWindow, filterByType, type ItemTypeFilter } from './grouping';

export const sidebarState = $state({
  items: [] as PlannerItem[],
  colors: {} as Record<string, string>,
  loading: false,
  error: null as string | null,
  filter: 'all' as ItemTypeFilter,
  lastSyncedAt: 0,
  open: true
});

export async function loadInitial() {
  const cached = await getCachedPlannerItems();
  if (cached) {
    sidebarState.items = cached;
    sidebarState.lastSyncedAt = Date.now();
  }
  sidebarState.colors = await getCourseColors().catch(() => ({}));
  await refresh();
}

export async function refresh() {
  sidebarState.loading = true;
  sidebarState.error = null;
  try {
    const items = await fetchPlannerItems();
    sidebarState.items = items;
    sidebarState.lastSyncedAt = Date.now();
    await setCachedPlannerItems(items);
  } catch (err) {
    sidebarState.error = err instanceof Error ? err.message : String(err);
  } finally {
    sidebarState.loading = false;
  }
}

export function groupedView() {
  const filtered = filterByType(sidebarState.items, sidebarState.filter);
  return groupByDueWindow(filtered);
}
```

- [ ] **Step 3: Replace Sidebar.svelte with state-driven version**

```svelte
<script lang="ts">
  import { sidebarState, loadInitial, refresh, groupedView } from './stores.svelte';
  import { onMount } from 'svelte';

  let { open: openProp = true }: { open?: boolean } = $props();
  $effect.pre(() => { sidebarState.open = openProp; });

  let groups = $derived(groupedView());

  onMount(() => {
    loadInitial();
    const onFocus = () => {
      if (Date.now() - sidebarState.lastSyncedAt > 2 * 60_000) refresh();
    };
    window.addEventListener('focus', onFocus);
    const onToggle = () => { sidebarState.open = !sidebarState.open; };
    document.addEventListener('paintbrush:toggle', onToggle);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('paintbrush:toggle', onToggle);
    };
  });

  const groupOrder: Array<[keyof ReturnType<typeof groupedView>, string, string]> = [
    ['overdue', 'Overdue', 'text-red-600 dark:text-red-400'],
    ['today', 'Today', 'text-zinc-700 dark:text-zinc-300'],
    ['tomorrow', 'Tomorrow', 'text-zinc-700 dark:text-zinc-300'],
    ['thisWeek', 'This Week', 'text-zinc-700 dark:text-zinc-300'],
    ['later', 'Later', 'text-zinc-700 dark:text-zinc-300']
  ];

  function totalCount() {
    return groups.overdue.length + groups.today.length + groups.tomorrow.length + groups.thisWeek.length + groups.later.length;
  }
</script>

<aside class="fixed right-0 top-0 z-[2147483647] h-screen bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-sans shadow-lg transition-transform duration-200 ease-out"
       class:translate-x-0={sidebarState.open}
       class:!translate-x-[calc(100%-44px)]={!sidebarState.open}
       style="width: 320px; will-change: transform;">
  <header class="flex items-center justify-between gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800">
    <div class="flex items-center gap-2">
      <h2 class="text-sm font-semibold tracking-tight">Paintbrush</h2>
      <span class="text-[11px] text-zinc-400">{totalCount()}</span>
    </div>
    <div class="flex items-center gap-1">
      <button class="px-1.5 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50"
              disabled={sidebarState.loading}
              onclick={() => refresh()}
              aria-label="Refresh">↻</button>
      <button class="px-1.5 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              onclick={() => sidebarState.open = !sidebarState.open}
              aria-label="Collapse">{sidebarState.open ? '›' : '‹'}</button>
    </div>
  </header>

  {#if sidebarState.error}
    <div class="p-3 text-xs text-red-600 dark:text-red-400">Error: {sidebarState.error}</div>
  {:else if totalCount() === 0 && !sidebarState.loading}
    <div class="p-8 text-center text-sm text-zinc-500">All caught up 🎉</div>
  {:else}
    <div class="overflow-y-auto" style="height: calc(100vh - 53px);">
      {#each groupOrder as [key, label, color]}
        {#if groups[key].length > 0}
          <div class="sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider {color}">
            {label} <span class="text-zinc-400 font-normal">{groups[key].length}</span>
          </div>
          {#each groups[key] as item (item.plannable_id + ':' + item.plannable_type)}
            <!-- TodoItem placeholder; real component arrives in Task 11 -->
            <a href={item.html_url} target="_blank" rel="noopener" class="block px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-l-[3px]" style="border-color: {sidebarState.colors['course_' + item.course_id] ?? '#cbd5e1'}">
              <div class="text-sm font-medium truncate">{item.plannable.title ?? item.plannable.name ?? 'Untitled'}</div>
              <div class="text-[11px] text-zinc-500">{item.context_name ?? ''}</div>
            </a>
          {/each}
        {/if}
      {/each}
    </div>
  {/if}
</aside>
```

- [ ] **Step 4: Build + manual smoke test**

Run:
```bash
npm run build
```

Then reload extension in Chrome, refresh a Canvas page. Expected:
- Sidebar shows your real planner items grouped by Today/Tomorrow/etc.
- Course color stripe on the left of each card matches Canvas's dashboard colors
- Refresh button works
- "All caught up 🎉" shows if no items in the next 30 days

- [ ] **Step 5: Commit**

```bash
git add src/content/sidebar/
git commit -m "feat(sidebar): load and render planner items grouped by due window"
```

---

## Task 11: TodoItem component with mark-complete

**Files:**
- Create: `src/content/sidebar/TodoItem.svelte`
- Modify: `src/content/sidebar/Sidebar.svelte`
- Modify: `src/content/sidebar/stores.svelte.ts`

- [ ] **Step 1: Add markItemComplete to stores**

In `src/content/sidebar/stores.svelte.ts`, append:

```ts
import { markComplete } from './api';
import type { PlannerItem } from '../../lib/types';

export async function markItemComplete(item: PlannerItem) {
  try {
    await markComplete(item);
    sidebarState.items = sidebarState.items.map((i) =>
      i.plannable_id === item.plannable_id && i.plannable_type === item.plannable_type
        ? { ...i, planner_override: { id: 0, marked_complete: true } }
        : i
    );
  } catch (err) {
    sidebarState.error = err instanceof Error ? err.message : String(err);
  }
}
```

- [ ] **Step 2: Create TodoItem.svelte**

```svelte
<script lang="ts">
  import type { PlannerItem } from '../../lib/types';
  import { markItemComplete } from './stores.svelte';

  let { item, color = '#cbd5e1' }: { item: PlannerItem; color?: string } = $props();

  const typeIcon: Record<string, string> = {
    assignment: '📝',
    quiz: '✓',
    discussion_topic: '💬',
    planner_note: '📌',
    announcement: '📣',
    wiki_page: '📄',
    calendar_event: '📅'
  };

  function relativeDue(iso: string): string {
    const due = new Date(iso);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const absHours = Math.abs(diffMs) / 3_600_000;
    if (absHours < 24 && diffMs > 0) {
      const h = Math.round(absHours);
      return h <= 1 ? 'in <1h' : `in ${h}h`;
    }
    return due.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  }

  const title = $derived(item.plannable.title ?? item.plannable.name ?? 'Untitled');
  const points = $derived(item.plannable.points_possible);
  let hovered = $state(false);
  let busy = $state(false);

  async function onMarkDone(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    busy = true;
    await markItemComplete(item);
    busy = false;
  }
</script>

<a href={item.html_url}
   target="_blank"
   rel="noopener"
   onmouseenter={() => (hovered = true)}
   onmouseleave={() => (hovered = false)}
   class="group relative block pl-3 pr-2 py-2 border-l-[3px] hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
   style="border-color: {color}">
  <div class="flex items-start gap-2">
    <span class="text-base leading-none mt-0.5" aria-hidden="true">{typeIcon[item.plannable_type] ?? '•'}</span>
    <div class="min-w-0 flex-1">
      <div class="text-sm font-medium leading-snug truncate">{title}</div>
      <div class="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
        <span class="truncate">{item.context_name ?? ''}</span>
        <span>·</span>
        <span class="whitespace-nowrap">{relativeDue(item.plannable_date)}</span>
        {#if points != null}
          <span>·</span>
          <span>{points} pts</span>
        {/if}
      </div>
    </div>
    {#if hovered}
      <button
        onclick={onMarkDone}
        disabled={busy}
        class="absolute right-2 top-2 px-1.5 py-0.5 text-[11px] rounded bg-indigo-600 text-white opacity-90 hover:opacity-100 disabled:opacity-50"
        title="Mark as done">
        ✓
      </button>
    {/if}
  </div>
</a>
```

- [ ] **Step 3: Use TodoItem inside Sidebar.svelte**

In `Sidebar.svelte`, replace the placeholder anchor inside the `{#each groups[key]...}` block:

```svelte
<script>
  // (existing imports)
  import TodoItem from './TodoItem.svelte';
</script>

<!-- inside the each loop -->
{#each groups[key] as item (item.plannable_id + ':' + item.plannable_type)}
  <TodoItem {item} color={sidebarState.colors['course_' + item.course_id] ?? '#cbd5e1'} />
{/each}
```

- [ ] **Step 4: Build + manual smoke test**

Run:
```bash
npm run build
```

Reload extension, refresh Canvas. Expected:
- Cards show type icon, title, course, relative due time, points
- Hovering a card shows a small "✓" button on the right
- Clicking "✓" marks the planner override; the item visibly moves to a "completed" state (disappears from overdue, stays in current group otherwise) — Canvas should reflect this on next refresh

- [ ] **Step 5: Commit**

```bash
git add src/content/sidebar/
git commit -m "feat(sidebar): add TodoItem with hover mark-complete action"
```

---

## Task 12: Button injection on Canvas /files and /modules

**Files:**
- Create: `src/content/inject/buttons.ts`
- Modify: `src/content/index.ts`

- [ ] **Step 1: Create src/content/inject/buttons.ts**

```ts
import { parseCourseFromUrl, isFilesPage, isModulesPage } from '../../lib/course-context';

export interface ButtonConfig {
  id: string;
  label: string;
  onClick: (courseId: number) => void;
}

const HEADER_SELECTORS = [
  '#right-side-wrapper .header',
  '#section-tabs-header',
  '.ic-Action-header__Primary',
  '#content header.page-header',
  '#breadcrumbs'
];

function findInjectionTarget(): HTMLElement | null {
  for (const sel of HEADER_SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

function makeButton(config: ButtonConfig, courseId: number): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = config.id;
  btn.type = 'button';
  btn.textContent = config.label;
  btn.style.cssText = [
    'display: inline-flex',
    'align-items: center',
    'gap: 6px',
    'padding: 6px 12px',
    'margin: 6px 8px 6px 0',
    'border-radius: 4px',
    'background: #4f46e5',
    'color: #fff',
    'font: 600 13px/1.2 system-ui, sans-serif',
    'border: none',
    'cursor: pointer'
  ].join(';');
  btn.addEventListener('click', () => config.onClick(courseId));
  return btn;
}

export function injectButton(config: ButtonConfig): boolean {
  if (document.getElementById(config.id)) return true;
  const courseId = parseCourseFromUrl(location.href);
  if (courseId == null) return false;
  const target = findInjectionTarget();
  if (!target) return false;
  target.prepend(makeButton(config, courseId));
  return true;
}

export function watchAndInject(button: ButtonConfig, predicate: () => boolean): () => void {
  let cancelled = false;
  const attempt = () => {
    if (cancelled) return;
    if (predicate()) injectButton(button);
  };

  attempt();

  const observer = new MutationObserver(() => attempt());
  observer.observe(document.body, { childList: true, subtree: true });

  let lastUrl = location.href;
  const urlInterval = window.setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.getElementById(button.id)?.remove();
      attempt();
    }
  }, 500);

  return () => {
    cancelled = true;
    observer.disconnect();
    window.clearInterval(urlInterval);
  };
}

export { isFilesPage, isModulesPage };
```

- [ ] **Step 2: Wire injection into content script**

Replace `src/content/index.ts`:

```ts
import { mountSidebar } from './inject/mount';
import { watchAndInject, isFilesPage, isModulesPage } from './inject/buttons';

let unmount: (() => void) | null = null;

async function init() {
  unmount = await mountSidebar();

  watchAndInject(
    {
      id: 'paintbrush-download-files-btn',
      label: '⬇ Download all files (.zip)',
      onClick: (courseId) => {
        console.log('[Paintbrush] files download requested for course', courseId);
        alert('Files download coming next task.');
      }
    },
    () => isFilesPage(location.href)
  );

  watchAndInject(
    {
      id: 'paintbrush-export-modules-btn',
      label: '⬇ Export modules (.zip)',
      onClick: (courseId) => {
        console.log('[Paintbrush] modules export requested for course', courseId);
        alert('Modules export coming next task.');
      }
    },
    () => isModulesPage(location.href)
  );
}

init().catch((err) => console.error('[Paintbrush]', err));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'TOGGLE_SIDEBAR') {
    document.dispatchEvent(new CustomEvent('paintbrush:toggle'));
  }
});
```

- [ ] **Step 3: Build + manual smoke**

Run:
```bash
npm run build
```

Reload extension. Expected:
- Visit `/courses/:id/files` — "⬇ Download all files (.zip)" button appears in the page header; clicking shows alert.
- Visit `/courses/:id/modules` — "⬇ Export modules (.zip)" appears similarly.
- Navigate between courses without reload — button reappears thanks to URL polling + MutationObserver.

- [ ] **Step 4: Commit**

```bash
git add src/content/inject/buttons.ts src/content/index.ts
git commit -m "feat(inject): add Canvas page button injection with SPA navigation support"
```

---

## Task 13: Progress modal component

**Files:**
- Create: `src/content/downloader/Progress.svelte`
- Create: `src/content/downloader/progress-host.svelte.ts`

- [ ] **Step 1: Create Progress.svelte**

```svelte
<script lang="ts">
  type Phase = 'running' | 'done' | 'error' | 'cancelled';
  let {
    title = 'Downloading…',
    currentFile = '',
    completed = 0,
    total = 0,
    phase = 'running' as Phase,
    error = '',
    successMessage = '',
    onCancel = () => {}
  }: {
    title?: string;
    currentFile?: string;
    completed?: number;
    total?: number;
    phase?: Phase;
    error?: string;
    successMessage?: string;
    onCancel?: () => void;
  } = $props();

  let percent = $derived(total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0);
</script>

<div class="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 font-sans">
  <div class="w-[420px] rounded-lg bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 p-5 text-zinc-900 dark:text-zinc-100">
    {#if phase === 'running'}
      <h3 class="text-sm font-semibold">{title}</h3>
      <div class="mt-3 text-xs text-zinc-500 truncate" title={currentFile}>{currentFile || ' '}</div>
      <div class="mt-2 flex items-center gap-3">
        <div class="flex-1 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div class="h-full bg-indigo-600 transition-all" style="width: {percent}%"></div>
        </div>
        <span class="text-xs tabular-nums text-zinc-500">{completed} / {total}</span>
      </div>
      <div class="mt-4 flex justify-end">
        <button onclick={onCancel}
                class="px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          Cancel
        </button>
      </div>
    {:else if phase === 'done'}
      <h3 class="text-sm font-semibold">Done</h3>
      <p class="mt-2 text-xs text-zinc-500">{successMessage}</p>
    {:else if phase === 'error'}
      <h3 class="text-sm font-semibold text-red-600">Download failed</h3>
      <p class="mt-2 text-xs text-zinc-500 whitespace-pre-wrap">{error}</p>
      <div class="mt-4 flex justify-end">
        <button onclick={onCancel}
                class="px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          Close
        </button>
      </div>
    {:else}
      <h3 class="text-sm font-semibold">Cancelled</h3>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Create src/content/downloader/progress-host.svelte.ts**

The `.svelte.ts` extension tells the Svelte 5 compiler that runes (`$state`, etc.) are valid in this non-`.svelte` file.

```ts
import { mount, unmount } from 'svelte';
import Progress from './Progress.svelte';
import tailwindCss from '../../styles/tailwind.css?inline';

export interface ProgressHandle {
  update(state: ProgressState): void;
  done(successMessage: string, autoCloseMs?: number): void;
  error(message: string): void;
  cancelled(): void;
  close(): void;
  onCancel(handler: () => void): void;
}

export interface ProgressState {
  title?: string;
  currentFile?: string;
  completed?: number;
  total?: number;
}

export function openProgress(initial: ProgressState = {}): ProgressHandle {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = tailwindCss;
  shadow.appendChild(style);
  const target = document.createElement('div');
  shadow.appendChild(target);

  const state = $state({
    title: initial.title ?? 'Downloading…',
    currentFile: initial.currentFile ?? '',
    completed: initial.completed ?? 0,
    total: initial.total ?? 0,
    phase: 'running' as 'running' | 'done' | 'error' | 'cancelled',
    error: '',
    successMessage: '',
    onCancel: () => {}
  });

  const app = mount(Progress, { target, props: state });

  function close() {
    unmount(app);
    host.remove();
  }

  return {
    update(s) {
      if (s.title !== undefined) state.title = s.title;
      if (s.currentFile !== undefined) state.currentFile = s.currentFile;
      if (s.completed !== undefined) state.completed = s.completed;
      if (s.total !== undefined) state.total = s.total;
    },
    done(successMessage, autoCloseMs = 4000) {
      state.phase = 'done';
      state.successMessage = successMessage;
      setTimeout(close, autoCloseMs);
    },
    error(message) {
      state.phase = 'error';
      state.error = message;
    },
    cancelled() {
      state.phase = 'cancelled';
      setTimeout(close, 1500);
    },
    close,
    onCancel(handler) {
      state.onCancel = handler;
    }
  };
}
```

- [ ] **Step 3: Build to verify**

Run:
```bash
npm run build
```

Expected: builds without errors. (Manual UI testing happens in Task 14 when we wire it to the files download.)

- [ ] **Step 4: Commit**

```bash
git add src/content/downloader/Progress.svelte src/content/downloader/progress-host.svelte.ts
git commit -m "feat(downloader): add progress modal hosted in its own shadow DOM"
```

---

## Task 14: Files bulk download

**Files:**
- Create: `src/content/downloader/files.ts`
- Modify: `src/content/index.ts`

- [ ] **Step 1: Create src/content/downloader/files.ts**

```ts
import { fetchAllPages, fetchWithRetry, CanvasApiError } from '../../lib/canvas-api';
import { createZip, generateZipBlob, joinPath, safeFilename, safeFolderName, triggerDownload } from './zip';
import { openProgress } from './progress-host.svelte';
import type { Course, Folder, CanvasFile } from '../../lib/types';

const CONCURRENCY = 4;

async function fetchCourse(courseId: number, signal: AbortSignal): Promise<Course> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}`, { signal });
  if (!res.ok) throw new CanvasApiError(`Failed to fetch course ${courseId}`, res.status);
  return res.json();
}

async function fetchFolders(courseId: number, signal: AbortSignal): Promise<Folder[]> {
  return fetchAllPages<Folder>(`/api/v1/courses/${courseId}/folders?per_page=100`, { signal });
}

async function fetchFilesForFolder(folderId: number, signal: AbortSignal): Promise<CanvasFile[]> {
  return fetchAllPages<CanvasFile>(`/api/v1/folders/${folderId}/files?per_page=100`, { signal });
}

interface PendingFile {
  file: CanvasFile;
  folderPath: string; // course-relative
}

function buildFolderPaths(folders: Folder[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const f of folders) {
    const parts = f.full_name.split('/').slice(1).map(safeFolderName); // drop leading "course files"
    map.set(f.id, parts.join('/'));
  }
  return map;
}

async function fetchBlob(url: string, signal: AbortSignal): Promise<Blob> {
  const res = await fetchWithRetry(url, { signal, maxRetries: 3 });
  if (!res.ok) throw new CanvasApiError(`Download failed: ${res.status}`, res.status);
  return res.blob();
}

async function withConcurrency<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  concurrency: number,
  signal: AbortSignal
): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    while (true) {
      if (signal.aborted) return;
      const i = cursor++;
      if (i >= items.length) return;
      await worker(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => next()));
}

export async function downloadAllFiles(courseId: number): Promise<void> {
  const controller = new AbortController();
  const progress = openProgress({ title: 'Listing files…' });
  progress.onCancel(() => controller.abort());

  const failures: Array<{ name: string; reason: string }> = [];

  try {
    const [course, folders] = await Promise.all([
      fetchCourse(courseId, controller.signal),
      fetchFolders(courseId, controller.signal)
    ]);

    const pathByFolder = buildFolderPaths(folders);
    const pending: PendingFile[] = [];
    for (const f of folders) {
      const folderPath = pathByFolder.get(f.id) ?? '';
      const files = await fetchFilesForFolder(f.id, controller.signal);
      for (const file of files) pending.push({ file, folderPath });
    }

    const zip = createZip();
    let completed = 0;
    progress.update({ title: 'Downloading files…', total: pending.length, completed: 0 });

    await withConcurrency(
      pending,
      async ({ file, folderPath }) => {
        const fname = safeFilename(file.display_name || file.filename || `file-${file.id}`);
        progress.update({ currentFile: fname });
        try {
          const blob = await fetchBlob(file.url, controller.signal);
          zip.file(joinPath(folderPath, fname) || fname, blob);
        } catch (err) {
          failures.push({ name: fname, reason: err instanceof Error ? err.message : String(err) });
        } finally {
          completed += 1;
          progress.update({ completed });
        }
      },
      CONCURRENCY,
      controller.signal
    );

    if (controller.signal.aborted) {
      progress.cancelled();
      return;
    }

    if (failures.length > 0) {
      const lines = ['# Failed downloads', '', ...failures.map(f => `- ${f.name}: ${f.reason}`)];
      zip.file('FAILURES.md', lines.join('\n'));
    }

    progress.update({ title: 'Packaging ZIP…', currentFile: '' });
    const blob = await generateZipBlob(zip);
    const filename = `${safeFilename(course.course_code || course.name)}-files.zip`;
    triggerDownload(blob, filename);
    progress.done(`Saved ${filename}`);
  } catch (err) {
    if (controller.signal.aborted) {
      progress.cancelled();
      return;
    }
    progress.error(err instanceof Error ? err.message : String(err));
  }
}
```

- [ ] **Step 2: Wire downloadAllFiles into the button**

In `src/content/index.ts`, replace the files button handler:

```ts
import { downloadAllFiles } from './downloader/files';

// ...inside init(), replace the files button entry:
watchAndInject(
  {
    id: 'paintbrush-download-files-btn',
    label: '⬇ Download all files (.zip)',
    onClick: (courseId) => downloadAllFiles(courseId)
  },
  () => isFilesPage(location.href)
);
```

- [ ] **Step 3: Build + manual smoke**

Run:
```bash
npm run build
```

Reload extension, visit `/courses/:id/files` on a real course. Click the button. Expected:
- Progress modal appears, counts files, shows progress
- ZIP downloads with structure: `course-files.zip` → folders matching Canvas layout → original filenames
- Cancel button mid-download aborts cleanly without a corrupt ZIP

- [ ] **Step 4: Commit**

```bash
git add src/content/downloader/files.ts src/content/index.ts
git commit -m "feat(downloader): implement bulk Files download with progress + cancel"
```

---

## Task 15: Modules export

**Files:**
- Create: `src/content/downloader/modules.ts`
- Modify: `src/content/index.ts`

- [ ] **Step 1: Create src/content/downloader/modules.ts**

```ts
import { fetchAllPages, fetchWithRetry, CanvasApiError } from '../../lib/canvas-api';
import { createZip, generateZipBlob, joinPath, safeFilename, safeFolderName, triggerDownload } from './zip';
import { openProgress } from './progress-host.svelte';
import { htmlToMarkdown, extractCanvasFileRefs, rewriteCanvasFileLinks } from './markdown';
import type { Course, Module, ModuleItem, Page, Assignment, CanvasFile } from '../../lib/types';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function frontmatter(fields: Record<string, string>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) lines.push(`${k}: ${JSON.stringify(v)}`);
  lines.push('---', '');
  return lines.join('\n');
}

async function fetchCourse(courseId: number, signal: AbortSignal): Promise<Course> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}`, { signal });
  if (!res.ok) throw new CanvasApiError(`course ${courseId}`, res.status);
  return res.json();
}

async function fetchModules(courseId: number, signal: AbortSignal): Promise<Module[]> {
  return fetchAllPages<Module>(
    `/api/v1/courses/${courseId}/modules?include[]=items&include[]=content_details&per_page=100`,
    { signal }
  );
}

async function fetchPage(courseId: number, pageUrl: string, signal: AbortSignal): Promise<Page> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`, { signal });
  if (!res.ok) throw new CanvasApiError(`page ${pageUrl}`, res.status);
  return res.json();
}

async function fetchAssignment(courseId: number, id: number, signal: AbortSignal): Promise<Assignment> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}/assignments/${id}`, { signal });
  if (!res.ok) throw new CanvasApiError(`assignment ${id}`, res.status);
  return res.json();
}

async function fetchFile(courseId: number, id: number, signal: AbortSignal): Promise<CanvasFile> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}/files/${id}`, { signal });
  if (!res.ok) throw new CanvasApiError(`file ${id}`, res.status);
  return res.json();
}

async function fetchBlob(url: string, signal: AbortSignal): Promise<Blob> {
  const res = await fetchWithRetry(url, { signal });
  if (!res.ok) throw new CanvasApiError(`blob ${url}`, res.status);
  return res.blob();
}

interface ExportStats {
  modules: number;
  items: number;
  pagesAsMarkdown: number;
  filesIncluded: number;
  failures: Array<{ module: string; item: string; reason: string }>;
}

function renderAssignmentMd(a: Assignment, courseHtmlUrl: string): string {
  const meta = frontmatter({
    title: a.name,
    points: String(a.points_possible),
    due_at: a.due_at ?? '',
    source: a.html_url || courseHtmlUrl
  });
  const body = a.description ? htmlToMarkdown(a.description) : '_(no description)_\n';
  return meta + `# ${a.name}\n\n` + body;
}

function renderPageMd(p: Page, body: string): string {
  return frontmatter({
    title: p.title,
    updated: p.updated_at,
    source: p.html_url
  }) + `# ${p.title}\n\n` + body;
}

export async function exportModules(courseId: number): Promise<void> {
  const controller = new AbortController();
  const progress = openProgress({ title: 'Listing modules…' });
  progress.onCancel(() => controller.abort());

  const stats: ExportStats = {
    modules: 0, items: 0, pagesAsMarkdown: 0, filesIncluded: 0, failures: []
  };

  try {
    const [course, modules] = await Promise.all([
      fetchCourse(courseId, controller.signal),
      fetchModules(courseId, controller.signal)
    ]);

    const zip = createZip();
    stats.modules = modules.length;
    const totalItems = modules.reduce((acc, m) => acc + (m.items?.length ?? 0), 0);
    let processed = 0;
    progress.update({ title: 'Exporting modules…', total: totalItems });

    for (const [mi, mod] of modules.entries()) {
      const modFolder = `${pad2(mi + 1)}-${safeFolderName(mod.name)}`;
      const readme: string[] = [`# ${mod.name}`, ''];
      const assetCache = new Map<number, { localPath: string; name: string }>();

      for (const [ii, item] of (mod.items ?? []).entries()) {
        if (controller.signal.aborted) break;
        const idx = pad2(ii + 1);
        const itemLabel = `${idx}-${safeFilename(item.title)}`;
        progress.update({ currentFile: `${mod.name} → ${item.title}` });

        try {
          switch (item.type) {
            case 'File': {
              if (item.content_id == null) break;
              const meta = await fetchFile(courseId, item.content_id, controller.signal);
              const blob = await fetchBlob(meta.url, controller.signal);
              const fname = `${idx}-${safeFilename(meta.display_name || meta.filename)}`;
              zip.file(joinPath(modFolder, fname), blob);
              readme.push(`- [${item.title}](${fname})`);
              stats.filesIncluded += 1;
              break;
            }
            case 'Page': {
              if (!item.page_url) break;
              const page = await fetchPage(courseId, item.page_url, controller.signal);
              const refs = extractCanvasFileRefs(page.body);
              for (const ref of refs) {
                if (assetCache.has(ref.fileId)) continue;
                try {
                  const meta = await fetchFile(courseId, ref.fileId, controller.signal);
                  const blob = await fetchBlob(meta.url, controller.signal);
                  const aname = safeFilename(meta.display_name || meta.filename);
                  zip.file(joinPath(modFolder, '_assets', aname), blob);
                  assetCache.set(ref.fileId, { localPath: joinPath('_assets', aname), name: aname });
                } catch {
                  // asset failure is non-fatal
                }
              }
              const rewritten = rewriteCanvasFileLinks(page.body, {
                resolveAssetPath: (id) => assetCache.get(id)?.localPath ?? '#'
              });
              const md = renderPageMd(page, htmlToMarkdown(rewritten));
              const mdName = `${idx}-${safeFilename(page.title)}.md`;
              zip.file(joinPath(modFolder, mdName), md);
              readme.push(`- [${item.title}](${mdName})`);
              stats.pagesAsMarkdown += 1;
              break;
            }
            case 'Assignment': {
              if (item.content_id == null) break;
              const a = await fetchAssignment(courseId, item.content_id, controller.signal);
              const md = renderAssignmentMd(a, course.id ? `/courses/${course.id}` : '');
              const mdName = `${idx}-${safeFilename(a.name)}.md`;
              zip.file(joinPath(modFolder, mdName), md);
              readme.push(`- [${item.title}](${mdName})`);
              break;
            }
            case 'Quiz':
            case 'Discussion': {
              // Use Canvas's generic content endpoint when available; otherwise reference URL.
              const mdName = `${idx}-${safeFilename(item.title)}.md`;
              const meta = frontmatter({ title: item.title, source: item.html_url ?? '' });
              zip.file(joinPath(modFolder, mdName), meta + `# ${item.title}\n\nSee Canvas: ${item.html_url ?? ''}\n`);
              readme.push(`- [${item.title}](${mdName})`);
              break;
            }
            case 'ExternalUrl':
            case 'ExternalTool': {
              readme.push(`- [${item.title}](${item.external_url ?? item.html_url ?? '#'})`);
              break;
            }
            case 'SubHeader': {
              readme.push('', `## ${item.title}`, '');
              break;
            }
          }
          stats.items += 1;
        } catch (err) {
          stats.failures.push({
            module: mod.name,
            item: item.title,
            reason: err instanceof Error ? err.message : String(err)
          });
        } finally {
          processed += 1;
          progress.update({ completed: processed });
        }
      }

      zip.file(joinPath(modFolder, 'README.md'), readme.join('\n') + '\n');
    }

    if (controller.signal.aborted) {
      progress.cancelled();
      return;
    }

    zip.file('manifest.md', renderManifest(course, stats));

    progress.update({ title: 'Packaging ZIP…', currentFile: '' });
    const blob = await generateZipBlob(zip);
    const filename = `${safeFilename(course.course_code || course.name)}-modules.zip`;
    triggerDownload(blob, filename);
    progress.done(`Saved ${filename}`);
  } catch (err) {
    if (controller.signal.aborted) {
      progress.cancelled();
      return;
    }
    progress.error(err instanceof Error ? err.message : String(err));
  }
}

function renderManifest(course: Course, stats: ExportStats): string {
  const lines = [
    `# ${course.name} — modules export`,
    '',
    `Exported: ${new Date().toISOString()}`,
    `Course: ${course.course_code} (id ${course.id})`,
    '',
    '## Summary',
    `- Modules: ${stats.modules}`,
    `- Items processed: ${stats.items}`,
    `- Pages exported as Markdown: ${stats.pagesAsMarkdown}`,
    `- Files included: ${stats.filesIncluded}`,
    `- Failures: ${stats.failures.length}`,
    ''
  ];
  if (stats.failures.length > 0) {
    lines.push('## Failures', '');
    for (const f of stats.failures) {
      lines.push(`- **${f.module} → ${f.item}**: ${f.reason}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
```

- [ ] **Step 2: Wire exportModules into the button**

In `src/content/index.ts`, replace the modules button handler:

```ts
import { exportModules } from './downloader/modules';

// ...inside init(), replace the modules button entry:
watchAndInject(
  {
    id: 'paintbrush-export-modules-btn',
    label: '⬇ Export modules (.zip)',
    onClick: (courseId) => exportModules(courseId)
  },
  () => isModulesPage(location.href)
);
```

- [ ] **Step 3: Build + manual smoke**

Run:
```bash
npm run build
```

Reload extension, visit `/courses/:id/modules` on a real course. Click "Export modules". Expected:
- Progress modal counts items across all modules
- ZIP downloads with `NN-module-name/` folders
- Each folder has a `README.md` linking to its items
- Pages are `.md` files with frontmatter; assignments are `.md` with metadata; files are present in original format
- `_assets/` per module holds embedded files referenced by pages
- Top-level `manifest.md` summarizes counts + failures

- [ ] **Step 4: Commit**

```bash
git add src/content/downloader/modules.ts src/content/index.ts
git commit -m "feat(downloader): implement Modules export to ZIP with markdown conversion"
```

---

## Task 16: Options page

**Files:**
- Create: `src/options/index.html`
- Create: `src/options/Options.svelte`
- Create: `src/options/main.ts`

- [ ] **Step 1: Create src/options/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Paintbrush — Options</title>
    <link rel="stylesheet" href="../styles/tailwind.css" />
  </head>
  <body class="font-sans bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create src/options/main.ts**

```ts
import { mount } from 'svelte';
import Options from './Options.svelte';

mount(Options, { target: document.getElementById('app')! });
```

- [ ] **Step 3: Create src/options/Options.svelte**

```svelte
<script lang="ts">
  import { getLocal, setLocal } from '../lib/storage';
  import { onMount } from 'svelte';

  let domains = $state<string[]>([]);
  let sidebarDefaultOpen = $state(true);
  let newDomain = $state('');
  let error = $state('');

  onMount(async () => {
    domains = await getLocal('customDomains');
    sidebarDefaultOpen = await getLocal('sidebarDefaultOpen');
  });

  function normalize(d: string): string | null {
    const trimmed = d.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) return null;
    return trimmed.toLowerCase();
  }

  async function addDomain() {
    error = '';
    const norm = normalize(newDomain);
    if (!norm) { error = 'Enter a valid hostname (e.g. canvas.myschool.edu)'; return; }
    if (domains.includes(norm)) { error = 'Already added.'; return; }
    const origin = `*://${norm}/*`;
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) { error = 'Permission denied.'; return; }
    try {
      await chrome.scripting.registerContentScripts([{
        id: `paintbrush-${norm}`,
        matches: [origin],
        js: ['src/content/index.ts'],
        runAt: 'document_idle'
      }]);
    } catch (err) {
      // Already registered? Update.
      await chrome.scripting.updateContentScripts([{
        id: `paintbrush-${norm}`,
        matches: [origin],
        js: ['src/content/index.ts'],
        runAt: 'document_idle'
      }]);
    }
    domains = [...domains, norm];
    await setLocal('customDomains', domains);
    newDomain = '';
  }

  async function removeDomain(d: string) {
    const origin = `*://${d}/*`;
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [`paintbrush-${d}`] });
    } catch { /* already gone */ }
    await chrome.permissions.remove({ origins: [origin] });
    domains = domains.filter((x) => x !== d);
    await setLocal('customDomains', domains);
  }

  async function toggleDefaultOpen() {
    sidebarDefaultOpen = !sidebarDefaultOpen;
    await setLocal('sidebarDefaultOpen', sidebarDefaultOpen);
  }
</script>

<main class="mx-auto max-w-2xl p-8">
  <h1 class="text-2xl font-semibold tracking-tight">Paintbrush</h1>
  <p class="mt-1 text-sm text-zinc-500">Options for the Canvas LMS extension.</p>

  <section class="mt-8">
    <h2 class="text-base font-semibold">Custom Canvas domains</h2>
    <p class="mt-1 text-sm text-zinc-500">Paintbrush works on *.instructure.com out of the box. Add your school's domain here if it uses a custom URL.</p>

    <div class="mt-4 flex gap-2">
      <input
        bind:value={newDomain}
        type="text"
        placeholder="canvas.myschool.edu"
        class="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
      <button onclick={addDomain}
              class="rounded bg-indigo-600 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-700">
        Add
      </button>
    </div>
    {#if error}<p class="mt-2 text-xs text-red-600">{error}</p>{/if}

    {#if domains.length > 0}
      <ul class="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 rounded border border-zinc-200 dark:border-zinc-800">
        {#each domains as d}
          <li class="flex items-center justify-between px-4 py-2">
            <code class="text-sm">{d}</code>
            <button onclick={() => removeDomain(d)} class="text-xs text-red-600 hover:underline">Remove</button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="mt-10">
    <h2 class="text-base font-semibold">Defaults</h2>
    <label class="mt-3 flex items-center gap-3 text-sm cursor-pointer">
      <input type="checkbox" checked={sidebarDefaultOpen} onchange={toggleDefaultOpen} />
      Show sidebar by default when opening Canvas pages
    </label>
  </section>
</main>
```

- [ ] **Step 4: Restore custom domains on browser startup**

Append to `src/background/service-worker.ts`:

```ts
chrome.runtime.onStartup.addListener(restoreCustomScripts);
chrome.runtime.onInstalled.addListener(restoreCustomScripts);

async function restoreCustomScripts() {
  const { customDomains = [] } = await chrome.storage.local.get('customDomains');
  for (const d of customDomains as string[]) {
    const origin = `*://${d}/*`;
    try {
      await chrome.scripting.registerContentScripts([{
        id: `paintbrush-${d}`,
        matches: [origin],
        js: ['src/content/index.ts'],
        runAt: 'document_idle'
      }]);
    } catch {
      // already registered
    }
  }
}
```

- [ ] **Step 5: Build + manual smoke**

Run:
```bash
npm run build
```

Reload extension. Right-click extension icon → "Options". Expected:
- Page renders with header, input, and toggle
- Adding a valid domain prompts the Chrome permission dialog; on grant the domain is listed
- The "Show sidebar by default" toggle persists across reloads (verify by toggling off, reloading a Canvas page — sidebar should start collapsed)

- [ ] **Step 6: Commit**

```bash
git add src/options/ src/background/service-worker.ts manifest.json
git commit -m "feat(options): add custom Canvas domain manager and default-open toggle"
```

---

## Task 17: Polish — icons, README, dark mode

**Files:**
- Replace: `public/icons/icon-*.png` (real icons)
- Create: `README.md`
- Modify: `src/content/inject/mount.ts` (dark mode class on shadow root)

- [ ] **Step 1: Create real icons**

Make a 128×128 PNG icon for the extension — a stylized paintbrush stroke on a transparent background. If using ImageMagick:

```bash
# Generate from a single 512x512 source
magick public/icons/source-512.png -resize 128x128 public/icons/icon-128.png
magick public/icons/source-512.png -resize 48x48 public/icons/icon-48.png
magick public/icons/source-512.png -resize 32x32 public/icons/icon-32.png
magick public/icons/source-512.png -resize 16x16 public/icons/icon-16.png
```

If no design asset available, ship the placeholder for v0.1 and note in README that icons are TBD. (The placeholder PNGs from Task 2 will still load — they're just invisible.)

- [ ] **Step 2: Add dark-mode class detection to mount**

Modify `src/content/inject/mount.ts` — in `mountSidebar`, after creating `shadow`:

```ts
function applyDarkMode() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  appRoot.classList.toggle('dark', isDark);
}
applyDarkMode();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyDarkMode);
```

(Put this right after creating `appRoot`.)

- [ ] **Step 3: Create README.md**

```markdown
# Paintbrush — Canvas LMS Chrome extension

A Chrome extension that paints two things onto Canvas:

- **A todos sidebar** pinned to the right edge of every Canvas page, showing your planner items grouped by Overdue / Today / Tomorrow / This Week / Later. Mark items complete inline.
- **Bulk download** — "Download all files (.zip)" on a course's Files page, "Export modules (.zip)" on the Modules page. Modules export converts Pages to Markdown, includes embedded files in `_assets/`, and bundles file/assignment/discussion items with metadata.

## Install (development)

```bash
npm install
npm run build
```

Then in Chrome → `chrome://extensions` → "Load unpacked" → select `dist/`.

## Custom Canvas domains

If your school hosts Canvas on a non-`*.instructure.com` URL, open the extension's Options page and add your domain. Chrome will prompt for permission to inject on that origin.

## How it works

The extension is content-script-first: it runs inside Canvas pages and uses your existing session cookies to hit `/api/v1/*`. No API token setup, no third-party server. The sidebar mounts in a shadow DOM so Canvas CSS can't bleed in.

See [docs/superpowers/specs/](docs/superpowers/specs/) for the full design.

## Tests

```bash
npm test          # one-shot
npm run test:watch
```

## Status

v0.1 — works on a single user's Canvas. No telemetry, no sync, no instructor tools.
```

- [ ] **Step 4: Run the full test suite**

Run:
```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add public/icons/ README.md src/content/inject/mount.ts
git commit -m "chore: add icons, README, and dark-mode handling"
```

---

## Final manual verification

After all tasks are complete, the user should perform a final pass:

- [ ] Side-load `dist/` into Chrome on a real Canvas account
- [ ] Sidebar appears on the dashboard and on `/courses/:id/*` pages with planner items grouped correctly
- [ ] Refresh button updates items; window focus auto-refreshes when stale
- [ ] Mark-complete sends the request and the item updates
- [ ] On `/courses/:id/files`, "Download all files" produces a structured ZIP
- [ ] On `/courses/:id/modules`, "Export modules" produces a ZIP with module folders, READMEs, markdown pages, files, and a top-level `manifest.md`
- [ ] Cancelling a download mid-flight works without leaving stuck UI
- [ ] Options page adds a custom domain and the sidebar appears on it
- [ ] Toolbar icon click toggles the sidebar
- [ ] Dark mode follows `prefers-color-scheme`

---

## Out of scope (not in this plan)

The spec's "Out of scope (v1)" section enumerates these: cross-course aggregated views beyond the planner sidebar, writing planner notes, calendar event display, quiz question export, submission upload, cross-device sync, Firefox/Safari builds. They will not be implemented here.
