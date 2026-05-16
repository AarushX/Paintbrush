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
