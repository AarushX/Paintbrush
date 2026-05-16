import canvasOverrides from './canvas-overrides.css?inline';

const STYLE_ID = 'paintbrush-skin';
const VAR_ATTR = 'data-paintbrush-skinned';

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
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    if (lum > 235) continue;
    return {
      brand: `rgb(${r}, ${g}, ${b})`,
      brandFg: lum < 140 ? '#ffffff' : '#1a1a1a'
    };
  }
  return null;
}

function applyBrandVars(): void {
  const detected = detectCanvasBrand();
  const brand = detected?.brand ?? '#4f46e5';
  const brandFg = detected?.brandFg ?? '#ffffff';
  const root = document.documentElement;
  root.style.setProperty('--pb-brand', brand);
  root.style.setProperty('--pb-brand-fg', brandFg);
  root.style.setProperty('--pb-brand-soft', `color-mix(in srgb, ${brand} 12%, transparent)`);
  root.style.setProperty('--pb-brand-strong', `color-mix(in srgb, ${brand} 80%, black)`);
}

export function applyCanvasSkin(): () => void {
  // Idempotent: if already applied, no-op
  if (document.getElementById(STYLE_ID)) return () => {};

  applyBrandVars();
  // Canvas applies theme CSS late on some pages — re-check shortly after.
  const t1 = window.setTimeout(applyBrandVars, 800);
  const t2 = window.setTimeout(applyBrandVars, 2000);

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = canvasOverrides;
  document.head.appendChild(style);
  document.documentElement.setAttribute(VAR_ATTR, 'true');

  return () => {
    style.remove();
    document.documentElement.removeAttribute(VAR_ATTR);
    document.documentElement.style.removeProperty('--pb-brand');
    document.documentElement.style.removeProperty('--pb-brand-fg');
    document.documentElement.style.removeProperty('--pb-brand-soft');
    document.documentElement.style.removeProperty('--pb-brand-strong');
    window.clearTimeout(t1);
    window.clearTimeout(t2);
  };
}
