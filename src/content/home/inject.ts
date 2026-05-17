import { mount, unmount } from 'svelte';
import HomeViewer from './HomeViewer.svelte';
import tailwindCss from '../../styles/tailwind.css?inline';

const HOST_ID = 'paintbrush-home-root';
const CONTAINER_SELECTORS = [
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

export function mountHomeViewer(courseId: number): () => void {
  console.log('[Paintbrush] mountHomeViewer entered, courseId =', courseId);
  if (document.getElementById(HOST_ID)) {
    console.log('[Paintbrush] home host already exists; skipping');
    return () => {};
  }

  const container = findContainer();
  const prevDisplay = container?.style.display ?? '';
  if (container) container.style.display = 'none';

  // Anchor the host as a fixed-position overlay covering the viewport from
  // the right edge of Canvas's global nav (~84px) to the left edge of our
  // Paintbrush sidebar. This bypasses Canvas's DOM entirely — the host
  // can't be hidden by Canvas wrapping it in a display:none ancestor.
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = [
    'all: initial',
    'display: block',
    'position: fixed',
    'top: 0',
    'left: 84px',
    'right: var(--pb-sidebar-w, 340px)',
    'bottom: 0',
    'overflow-y: auto',
    'background: #fafafa',
    'z-index: 1',
    'pointer-events: auto',
    'transition: right 300ms cubic-bezier(0.22,0.61,0.36,1)'
  ].join(';');
  document.body.appendChild(host);
  console.log('[Paintbrush] home host appended to body');

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

  const app = mount(HomeViewer, { target: appRoot, props: { courseId } });

  return () => {
    unmount(app);
    host.remove();
    if (container) container.style.display = prevDisplay;
    mq.removeEventListener('change', applyDarkMode);
  };
}
