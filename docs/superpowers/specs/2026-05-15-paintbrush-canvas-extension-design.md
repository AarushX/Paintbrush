# Paintbrush — Canvas LMS Chrome Extension

**Date:** 2026-05-15
**Status:** Design approved, pending spec review

## Purpose

A Chrome extension that augments Canvas LMS with two things students consistently want:

1. **An always-visible todos sidebar** — your Canvas planner items pinned to the right edge of every Canvas page, so you can see what's due while reading any assignment, module, or file.
2. **Bulk download** — single-click export of all course files (as a ZIP) and all modules (text as Markdown, files as files, structured by module).

The name "Paintbrush" reflects the fact that the extension paints additional UI onto Canvas without replacing it.

## Non-goals

- Not a Canvas replacement. We augment, never hide.
- Not a sync service. No background polling, no server, no account.
- Not a grading or instructor tool. Student-focused.
- Not a notes app. The sidebar shows todos; it doesn't let you write notes (Canvas planner notes are read/displayed only in v1).

## Users

A single Canvas student, side-loading the extension for their own use. No multi-tenant concerns, no telemetry.

## Stack

- **Svelte 5** (runes mode) for UI components — small runtime, excellent reactivity, fits a shadow-DOM mount cleanly
- **TypeScript** throughout
- **Vite** with `@crxjs/vite-plugin` for the MV3 extension build
- **JSZip** for in-browser ZIP packaging
- **Turndown** for HTML → Markdown conversion
- **Tailwind CSS** for utility styling inside the shadow DOM
- **Vitest** for unit tests

## Authentication

Session-based. The extension runs as a content script on Canvas pages, so `fetch('/api/v1/...')` carries the user's session cookies automatically. No API token setup. No CORS issues because the requests are same-origin with Canvas.

For write operations that Canvas protects with a CSRF cookie (`_csrf_token`), the API wrapper reads the cookie via `document.cookie` and forwards it as the `X-CSRF-Token` header.

## Permissions / manifest

```jsonc
{
  "manifest_version": 3,
  "name": "Paintbrush for Canvas",
  "version": "0.1.0",
  "permissions": ["storage", "scripting"],
  "host_permissions": ["*://*.instructure.com/*"],
  "optional_host_permissions": ["*://*/*"],
  "content_scripts": [
    {
      "matches": ["*://*.instructure.com/*"],
      "js": ["src/content/index.ts"],
      "run_at": "document_idle"
    }
  ],
  "background": { "service_worker": "src/background/service-worker.ts" },
  "options_page": "src/options/index.html",
  "action": { "default_title": "Paintbrush" }
}
```

Custom Canvas domains (e.g. `canvas.myschool.edu`) are not in the static matches. The Options page calls `chrome.permissions.request` and then `chrome.scripting.registerContentScripts` to inject on the new origin without requiring an extension reload.

## Architecture

```
src/
  content/
    index.ts              entry: detects page type, mounts sidebar, injects buttons
    sidebar/
      Sidebar.svelte      root component
      TodoItem.svelte     single planner item card
      GroupHeader.svelte  Today / Tomorrow / etc. sticky headers
      stores.ts           $state stores for items, filters, collapsed state
      api.ts              planner-specific API calls
    downloader/
      files.ts            "Download all files" flow
      modules.ts          "Export modules" flow
      markdown.ts         Turndown configuration + Canvas-specific cleanups
      zip.ts              JSZip wrapper with folder helpers + safe filename slugifier
      progress.svelte     progress modal component
    inject/
      mount.ts            creates shadow-DOM host, mounts Svelte app inside
      buttons.ts          finds Canvas toolbars on /files and /modules and injects buttons
  background/
    service-worker.ts     minimal — handles toolbar action click, opens sidebar toggle
  options/
    index.html
    Options.svelte        manage custom Canvas domains, default sidebar state
  lib/
    canvas-api.ts         fetch wrapper: pagination via Link header, retry, AbortController
    storage.ts            typed chrome.storage.local / .session helpers
    course-context.ts     parses /courses/:id from URL, fetches course metadata
    types.ts              Canvas API response types (subset we use)
  styles/
    tailwind.css
```

All API access happens in the content script (same-origin with Canvas). The service worker is intentionally minimal: it listens for `chrome.action.onClicked` and posts a `TOGGLE_SIDEBAR` message to the active tab's content script. ZIP building happens in the page context where it can't be killed by service-worker eviction.

The sidebar mounts inside a shadow DOM attached to a host `<div id="paintbrush-root">` appended to `document.body`. Tailwind styles are scoped to that shadow root via the `@apply`-emitted CSS injected as a `<style>` tag inside the shadow. Canvas's CSS cannot leak in.

## Component design

### Sidebar

**Mount conditions:** any URL matching the host patterns. Hidden by default on the Canvas login page (`/login/*`).

**Layout (320px wide expanded, 44px tab collapsed):**

```
┌─ Paintbrush ─────────────── ↻ ✕ ┐
│ [All] [Asgn] [Quiz] [Disc] [Notes]│
├──────────────────────────────────┤
│ OVERDUE (2)                       │
│ ▎ Problem set 4 — CS 61A          │
│   Due yesterday · 100 pts         │
│ ▎ ...                             │
│ TODAY                             │
│ ▎ Reading: Ch. 7 — HIST 100       │
│   Due 11:59pm                     │
│ TOMORROW                          │
│ ...                               │
└──────────────────────────────────┘
```

**State (Svelte 5 runes):**

```ts
let items   = $state<PlannerItem[]>([]);
let loading = $state(false);
let filter  = $state<ItemTypeFilter>('all');
let groups  = $derived(groupByDueWindow(items, filter));
```

**Data flow:**

1. On mount, read cached items from `chrome.storage.session` (5-min TTL) — instant paint.
2. Kick off a background refresh: `GET /api/v1/planner/items?start_date=<today-7d>&end_date=<today+30d>&per_page=50`, follow `Link: rel=next` until done.
3. In parallel, `GET /api/v1/users/self/colors` (returns `{custom_colors: {course_<id>: '#hex'}}`) for course color mapping (cached 24h in `chrome.storage.local`).
4. Replace cache + UI.
5. Refresh on `window.focus` if cache is >2 min old, or on manual ↻ click.

**Per-item card:**

- 3px left border using the course color
- Type icon (assignment / quiz / discussion / planner_note / announcement)
- Title (1-line truncate)
- Course code (small, dimmed)
- Due time: relative if within 24h ("in 3h"), otherwise "Mon 11:59pm"
- Points if `points_possible` is present
- Hover reveals a "✓" button → `POST /api/v1/planner/overrides` with body `{plannable_type, plannable_id, marked_complete: true}`; on success, item fades and re-groups
- Click on body → opens `item.html_url` in a new tab

**Groupings (computed from `plannable_date`):**

- **Overdue** — past due and not marked complete (red header)
- **Today** — due today
- **Tomorrow** — due tomorrow
- **This Week** — due within next 7 days excluding today/tomorrow
- **Later** — beyond 7 days

Empty state across all groups: "All caught up 🎉" centered.

### Files bulk download

**Activation:** When the URL matches `/courses/:id/files*`, `inject/buttons.ts` finds the page header (usually `#section-tabs-header` or `.ic-Action-header`) and prepends a Canvas-style button: **"Download all files (.zip)"**.

**Flow (`downloader/files.ts`):**

```
1. Extract courseId from URL
2. Fetch course: GET /api/v1/courses/:id
3. Walk folders:
   - GET /api/v1/courses/:id/folders?per_page=100 (paginated)
   - Build tree from `full_name` (which Canvas pre-resolves)
4. For each folder, list files:
   - GET /api/v1/folders/:fid/files?per_page=100 (paginated)
5. Concurrency-limited fetch (4 in flight) of each file's `url` as a Blob
6. Add to JSZip preserving folder structure under root folder named after course code
7. Generate ZIP as blob, trigger download via <a download="<course-code>-files.zip">
```

**Progress modal (`progress.svelte`):**

- Backdrop overlay (rgba(0,0,0,0.4)), centered card
- Header: "Downloading files…"
- Current file name (truncated middle)
- Counter: "23 / 87"
- Progress bar (overall % by file count, not bytes — Canvas doesn't reliably give sizes upfront)
- Cancel button → aborts via `AbortController`, ZIP is discarded, partial state cleared
- On complete: card swaps to "Done — saved `<filename>.zip`" with auto-dismiss in 4s

### Modules export

**Activation:** When the URL matches `/courses/:id/modules*`, inject **"Export modules (.zip)"** button into the page header.

**Flow (`downloader/modules.ts`):**

```
1. Extract courseId; fetch course
2. GET /api/v1/courses/:id/modules?include[]=items&include[]=content_details&per_page=100
3. For each module M (indexed NN starting at 01):
   folderName = `${NN}-${slug(M.name)}`
   readmeLines = [`# ${M.name}`, '']
   For each item I (indexed MM starting at 01):
     switch (I.type):
       case 'File':
         blob = await fetchFile(I.content_id)
         zip.file(`${folderName}/${MM}-${blob.name}`, blob)
         readmeLines.push(`- [${I.title}](${MM}-${blob.name})`)
       case 'Page':
         page = await fetch(`/api/v1/courses/${cid}/pages/${I.page_url}`)
         { md, assets } = htmlToMarkdown(page.body, { assetPrefix: '_assets' })
         zip.file(`${folderName}/${MM}-${slug(I.title)}.md`, frontmatter(page) + md)
         for (a of assets) zip.file(`${folderName}/_assets/${a.name}`, a.blob)
         readmeLines.push(`- [${I.title}](${MM}-${slug(I.title)}.md)`)
       case 'Assignment':
         a = await fetch(`/api/v1/courses/${cid}/assignments/${I.content_id}`)
         md = renderAssignmentMd(a)  // metadata block + Turndown(a.description)
         zip.file(`${folderName}/${MM}-${slug(I.title)}.md`, md)
         readmeLines.push(`- [${I.title}](${MM}-${slug(I.title)}.md)`)
       case 'Quiz':         // similar to Assignment; questions not exported
       case 'Discussion':   // topic + author + Turndown(message)
       case 'ExternalUrl':
       case 'ExternalTool':
         readmeLines.push(`- [${I.title}](${I.external_url || I.html_url})`)
       case 'SubHeader':
         readmeLines.push('', `## ${I.title}`, '')
   zip.file(`${folderName}/README.md`, readmeLines.join('\n'))
4. Top-level zip.file('manifest.md', renderManifest(courseInfo, stats, failures))
5. Save as `<course-code>-modules.zip`
```

**Markdown conversion (`downloader/markdown.ts`):**

Turndown configured with:

- GFM tables, strikethrough, task lists
- Heading style: ATX (`#` not underline)
- Code blocks: fenced
- A pre-pass that scans for Canvas file URLs (matching `/files/(\d+)/` or `/users/\d+/files/(\d+)/`) in `<a href>` and `<img src>`:
  - Fetches the file (deduped across the same export)
  - Adds it to `_assets/` for that module
  - Rewrites the link/src to `_assets/<name>`
- A pre-pass that strips Canvas-specific wrapper elements (`.user_content`, the equation image fallback) and unwraps math MathML/LaTeX where present
- Frontmatter for pages:

  ```yaml
  ---
  title: Lecture 3 — Trees
  updated: 2026-04-12T18:32:00Z
  source: https://canvas.../courses/1234/pages/lecture-3-trees
  ---
  ```

### Options page

Plain Svelte page at `src/options/index.html`. Two sections:

1. **Custom Canvas domains** — list with add/remove. Add flow: input → `chrome.permissions.request({origins: [`*://${domain}/*`]})` → on grant, register dynamic content script via `chrome.scripting.registerContentScripts`. Removal revokes the permission and unregisters.
2. **Defaults** — toggle "Show sidebar by default" (persisted to `chrome.storage.local`).

## Failure modes

| Failure | Behavior |
|---|---|
| Network timeout on API call | Exponential backoff: 250ms, 500ms, 1s. After 3 fails, surface in toast. Sidebar shows last cached items with a "stale" badge. |
| Network timeout on file blob | Same retry. After 3 fails, skip the file and record entry in `manifest.md` under "Failed downloads". Continue. |
| 401 (session expired) | Sidebar shows "Sign back in to Canvas" with a link to `/login`. Bulk operations abort with that message. |
| 403 on file (locked module item) | Skip + record in manifest. Continue. |
| 429 rate limit | Honor `Retry-After` header. Pause the in-flight batch, resume when it clears. |
| User navigates away mid-bulk-download | Modal shows "Stay on this tab until done" warning when started. `beforeunload` handler asks "Cancel download?" if leaving. |
| ZIP exceeds 1.5GB estimated | Pre-flight check (sum of file sizes from API metadata). If over, warn before starting and suggest folder-by-folder. |
| Canvas HTML embeds we can't render in MD (Kaltura video, LTI iframe) | Replaced with `[Embedded content — view on Canvas](<original-url>)` link. Listed in manifest. |

## Storage schema

`chrome.storage.local`:

```ts
{
  sidebarDefaultOpen: boolean        // default true
  customDomains: string[]            // ["canvas.myschool.edu"]
  courseColors: { [courseId]: string }  // 24h TTL via courseColorsFetchedAt
  courseColorsFetchedAt: number
}
```

`chrome.storage.session`:

```ts
{
  plannerCache: { items: PlannerItem[], fetchedAt: number }  // 5-min TTL
}
```

## Visual design

- **Type:** Inter, shipped as a font file with the extension (no external fetch)
- **Light/dark:** matches `prefers-color-scheme` with a manual override toggle in sidebar header
- **Palette:**
  - Background: `#ffffff` light / `#0f1115` dark
  - Surface: `#f7f8fa` / `#161922`
  - Border: `#e4e7ec` / `#262a36`
  - Text primary: `#1a1d23` / `#e7eaf0`
  - Text muted: `#6b7280` / `#8b93a3`
  - Accent (primary actions): `#4f46e5` (indigo-600)
  - Danger (overdue, cancel): `#dc2626` (red-600)
  - Course stripes use the hex from `/api/v1/users/self/colors` keyed by `course_<id>`
- **Motion:**
  - Sidebar open/close: `transform: translateX()`, 200ms, `cubic-bezier(0.2, 0, 0, 1)`
  - Progress modal: scale 0.96 → 1, opacity 0 → 1, 150ms
  - Item mark-complete: fade 200ms, then collapse height 200ms
- **Density:** Item cards 56px tall, 8px vertical gap, 12px horizontal padding. Generous but not airy.

## Testing strategy

**Unit (Vitest):**

- `markdown.ts`: HTML → MD for typical Canvas page samples (saved as fixtures under `tests/fixtures/`); asset rewriting; frontmatter generation
- `canvas-api.ts`: Link-header pagination follower; retry/backoff timing; CSRF header injection
- `course-context.ts`: URL parsing across Canvas URL shapes
- `zip.ts`: filename slugifier (handles `/`, `\0`, trailing dots, reserved names on Windows), folder path joining
- `sidebar/stores.ts`: groupByDueWindow across timezone edge cases (DST, midnight)

**Manual smoke (documented in README):**

1. Side-load extension, navigate to logged-in Canvas
2. Sidebar appears with planner items; refresh works; mark-complete works
3. Custom domain flow in Options page grants permission and injects on the new origin
4. `/courses/:id/files` shows download button; download produces a ZIP matching folder structure
5. `/courses/:id/modules` shows export button; ZIP contains module folders with mixed `.md` + files + `README.md` + top-level `manifest.md`

No E2E framework. The blast radius is one developer using a personal extension; Vitest + manual checks are the right amount.

## Repository layout

```
Paintbrush/
├── docs/superpowers/specs/
├── public/
│   ├── icons/                 16/32/48/128 PNG
│   └── fonts/Inter-*.woff2
├── src/
│   ├── content/...
│   ├── background/...
│   ├── options/...
│   ├── lib/...
│   └── styles/tailwind.css
├── tests/
│   ├── fixtures/canvas-page-*.html
│   └── *.test.ts
├── manifest.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── package.json
└── README.md
```

## Open questions deferred to implementation

- Exact selectors for injecting buttons on Canvas `/files` and `/modules` pages. These vary slightly across Canvas releases; the inject layer should query a few candidates and fall back gracefully. Will be validated against the user's live Canvas during manual smoke testing.
- Whether the sidebar should also surface "Announcements" alongside planner items. Out of scope for v1; revisit after first use.

## Out of scope (v1)

- Cross-course aggregated views beyond the planner sidebar
- Writing/editing planner notes from the sidebar
- Calendar event display
- Quiz question export
- Submission upload from the extension
- Sync between devices (everything is local to this browser profile)
- Firefox / Safari builds — Chromium only
