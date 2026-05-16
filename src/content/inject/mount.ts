import { mount, unmount } from 'svelte';
import Sidebar from '../sidebar/Sidebar.svelte';
import tailwindCss from '../../styles/tailwind.css?inline';
import { getLocal } from '../../lib/storage';

const HOST_ID = 'paintbrush-root';

// Sniff the active Canvas brand color from the left global nav so our sidebar
// looks like a sibling of it (matches institution theming when applied).
function detectCanvasBrand(): { brand: string; brandFg: string } | null {
  const candidates = ['.ic-app-header', '#header', '#mobile-header'];
  for (const sel of candidates) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;
    const bg = getComputedStyle(el).backgroundColor;
    const m = bg.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) continue;
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    // Skip transparent / near-white (Canvas theme JS may not be applied yet).
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    if (lum > 235) continue;
    return {
      brand: `rgb(${r}, ${g}, ${b})`,
      brandFg: lum < 140 ? '#ffffff' : '#1a1a1a'
    };
  }
  return null;
}

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

  const appRoot = document.createElement('div');
  appRoot.style.cssText = 'pointer-events: auto;';
  shadow.appendChild(appRoot);

  function applyBrand() {
    const detected = detectCanvasBrand();
    const brand = detected?.brand ?? '#4f46e5';
    const brandFg = detected?.brandFg ?? '#ffffff';
    appRoot.style.setProperty('--pb-brand', brand);
    appRoot.style.setProperty('--pb-brand-fg', brandFg);
    appRoot.style.setProperty('--pb-brand-soft', `color-mix(in srgb, ${brand} 12%, transparent)`);
    appRoot.style.setProperty('--pb-brand-strong', `color-mix(in srgb, ${brand} 80%, black)`);
  }
  applyBrand();
  // Canvas applies theme CSS late on some pages — re-check shortly after mount.
  setTimeout(applyBrand, 800);

  function applyDarkMode() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    appRoot.classList.toggle('dark', isDark);
  }
  applyDarkMode();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyDarkMode);

  // Offset the sidebar past the page's vertical scrollbar so the rail stays clickable.
  function applyScrollbarOffset() {
    const w = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    appRoot.style.setProperty('--pb-scrollbar-w', `${w}px`);
  }
  applyScrollbarOffset();
  window.addEventListener('resize', applyScrollbarOffset);
  const scrollbarRO = new ResizeObserver(applyScrollbarOffset);
  scrollbarRO.observe(document.documentElement);

  const defaultOpen = await getLocal('sidebarDefaultOpen');
  const app = mount(Sidebar, { target: appRoot, props: { open: defaultOpen } });

  return () => {
    unmount(app);
    host.remove();
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', applyDarkMode);
    window.removeEventListener('resize', applyScrollbarOffset);
    scrollbarRO.disconnect();
  };
}
