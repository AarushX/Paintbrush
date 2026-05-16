# Paintbrush — Canvas LMS Chrome extension

A Chrome extension that paints two things onto Canvas:

- **A todos sidebar** pinned to the right edge of every Canvas page, showing your planner items grouped by Overdue / Today / Tomorrow / This Week / Later. Mark items complete inline.
- **Bulk download** — "Download all files (.zip)" on a course's Files page, "Export modules (.zip)" on the Modules page. Modules export converts Pages to Markdown, includes embedded files in `_assets/`, and bundles file/assignment/discussion items with metadata.

## Install (development)

```bash
pnpm install
pnpm run build
```

Then in Chrome → `chrome://extensions` → "Load unpacked" → select `dist/`.

## Custom Canvas domains

If your school hosts Canvas on a non-`*.instructure.com` URL, open the extension's Options page and add your domain. Chrome will prompt for permission to inject on that origin.

## How it works

The extension is content-script-first: it runs inside Canvas pages and uses your existing session cookies to hit `/api/v1/*`. No API token setup, no third-party server. The sidebar mounts in a shadow DOM so Canvas CSS can't bleed in.

See [docs/superpowers/specs/](docs/superpowers/specs/) for the full design.

## Tests

```bash
pnpm test          # one-shot
pnpm run test:watch
```

## Status

v0.1 — works on a single user's Canvas. No telemetry, no sync, no instructor tools.
