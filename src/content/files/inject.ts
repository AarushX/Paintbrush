import { mount, unmount } from 'svelte';
import FilesViewer from './FilesViewer.svelte';
import tailwindCss from '../../styles/tailwind.css?inline';

const HOST_ID = 'paintbrush-files-root';

const HIDE_SELECTORS = [
  '#content',
  '#main',
  '.ic-Action-header',
  '#right-side-wrapper',
  '#section-tabs ~ *',
  '.ef-folder-content',
  '#filepreview',
  '#files_structure',
  '.tree'
];

interface Hidden { el: HTMLElement; prev: string }
const hidden: Hidden[] = [];

function hideCanvasUI(): void {
  for (const sel of HIDE_SELECTORS) {
    document.querySelectorAll<HTMLElement>(sel).forEach(el => {
      hidden.push({ el, prev: el.style.display });
      el.style.display = 'none';
    });
  }
}

function restoreCanvasUI(): void {
  for (const { el, prev } of hidden) el.style.display = prev;
  hidden.length = 0;
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

export function mountFilesViewer(courseId: number, initialFolderPath: string): () => void {
  if (document.getElementById(HOST_ID)) return () => {};

  const anchor = document.querySelector<HTMLElement>('#content') ?? document.querySelector<HTMLElement>('#main') ?? document.body;
  hideCanvasUI();

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all: initial; position: relative; width: 100%; pointer-events: auto;';
  anchor.parentNode?.insertBefore(host, anchor);

  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = tailwindCss;
  shadow.appendChild(styleEl);

  const appRoot = document.createElement('div');
  shadow.appendChild(appRoot);

  function applyBrand() {
    const d = detectBrand();
    const brand = d?.brand ?? '#4f46e5';
    const brandFg = d?.brandFg ?? '#ffffff';
    appRoot.style.setProperty('--pb-brand', brand);
    appRoot.style.setProperty('--pb-brand-fg', brandFg);
    appRoot.style.setProperty('--pb-brand-soft', `color-mix(in srgb, ${brand} 12%, transparent)`);
    appRoot.style.setProperty('--pb-brand-strong', `color-mix(in srgb, ${brand} 80%, black)`);
    appRoot.style.setProperty('--pb-scrollbar-w', '8px');
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

  const app = mount(FilesViewer, { target: appRoot, props: { courseId, initialFolderPath } });

  return () => {
    unmount(app);
    host.remove();
    restoreCanvasUI();
    mq.removeEventListener('change', applyDarkMode);
  };
}
