import { mount, unmount } from 'svelte';
import DiscussionViewer from './DiscussionViewer.svelte';
import tailwindCss from '../../styles/tailwind.css?inline';

const HOST_ID = 'paintbrush-discussion-root';

// Common Canvas selectors for the discussion content container — try in order.
const CONTAINER_SELECTORS = [
  '#discussion_container',
  '#discussion_topic',
  '.discussion-redesign',
  '[data-testid="discussion-redesign"]',
  '#main #content',
  '#content',
  '#main'
];

function findContainer(): HTMLElement | null {
  for (const sel of CONTAINER_SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

function detectBrand() {
  const candidates = ['.ic-app-header', '#header', '#mobile-header'];
  for (const sel of candidates) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) continue;
    const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    if (lum > 235) continue;
    return { brand: `rgb(${r}, ${g}, ${b})`, brandFg: lum < 140 ? '#ffffff' : '#1a1a1a' };
  }
  return null;
}

let active: { host: HTMLElement; app: ReturnType<typeof mount>; container: HTMLElement | null; prevDisplay: string } | null = null;

export function mountDiscussionViewer(courseId: number, topicId: number): () => void {
  if (document.getElementById(HOST_ID)) return () => {};

  const container = findContainer();
  const prevDisplay = container?.style.display ?? '';
  if (container) container.style.display = 'none';

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all: initial; position: relative; width: 100%; pointer-events: auto;';
  // Insert before container so layout doesn't jump when container hides
  if (container && container.parentNode) {
    container.parentNode.insertBefore(host, container);
  } else {
    document.body.appendChild(host);
  }

  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = tailwindCss;
  shadow.appendChild(styleEl);

  const appRoot = document.createElement('div');
  shadow.appendChild(appRoot);

  // Apply brand vars + dark mode (same pattern as sidebar)
  function applyBrand() {
    const d = detectBrand();
    const brand = d?.brand ?? '#4f46e5';
    const brandFg = d?.brandFg ?? '#ffffff';
    appRoot.style.setProperty('--pb-brand', brand);
    appRoot.style.setProperty('--pb-brand-fg', brandFg);
    appRoot.style.setProperty('--pb-brand-soft', `color-mix(in srgb, ${brand} 12%, transparent)`);
    appRoot.style.setProperty('--pb-brand-strong', `color-mix(in srgb, ${brand} 80%, black)`);
  }
  applyBrand();
  setTimeout(applyBrand, 800);

  function applyDarkMode() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    appRoot.classList.toggle('dark', isDark);
  }
  applyDarkMode();
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', applyDarkMode);

  const app = mount(DiscussionViewer, { target: appRoot, props: { courseId, topicId } });

  active = { host, app, container, prevDisplay };

  return () => {
    unmount(app);
    host.remove();
    if (active?.container) active.container.style.display = active.prevDisplay;
    mq.removeEventListener('change', applyDarkMode);
    active = null;
  };
}

export function unmountDiscussionViewer() {
  // For internal use if needed; the returned function from mount is the canonical teardown.
  if (!active) return;
  unmount(active.app);
  active.host.remove();
  if (active.container) active.container.style.display = active.prevDisplay;
  active = null;
}
