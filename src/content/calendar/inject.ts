import { mount, unmount } from 'svelte';
import CalendarViewer from './CalendarViewer.svelte';
import tailwindCss from '../../styles/tailwind.css?inline';

const HOST_ID = 'paintbrush-calendar-root';

const HIDE_SELECTORS = [
  '#full_calendar',
  '.full_calendar',
  '#calendar_holder',
  '#calendar-app',
  '.calendar2',
  '#content',
  '#main',
  '.ic-Action-header',
  '#right-side-wrapper'
];

interface Hidden { el: HTMLElement; prev: string }

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

export function mountCalendarViewer(): () => void {
  if (document.getElementById(HOST_ID)) return () => {};

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

  const anchor = document.querySelector<HTMLElement>('#main')
    ?? document.querySelector<HTMLElement>('#content')
    ?? document.body;

  hideCanvasUI();

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all: initial; display: block; position: fixed; top: 0; left: 84px; right: 0; bottom: 0; overflow-y: auto; background: #fafafa; z-index: 100; pointer-events: auto;';
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
  }
  applyBrand();
  setTimeout(applyBrand, 800);

  function applyScrollbarOffset() {
    const w = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    appRoot.style.setProperty('--pb-scrollbar-w', `${w}px`);
  }
  applyScrollbarOffset();
  window.addEventListener('resize', applyScrollbarOffset);

  function applyDarkMode() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    appRoot.classList.toggle('dark', isDark);
  }
  applyDarkMode();
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', applyDarkMode);

  const app = mount(CalendarViewer, { target: appRoot });

  return () => {
    unmount(app);
    host.remove();
    restoreCanvasUI();
    window.removeEventListener('resize', applyScrollbarOffset);
    mq.removeEventListener('change', applyDarkMode);
  };
}
