// Runs at document_start, before Canvas paints anything. The sole purpose
// of this script is FOUC prevention: tag <html data-pb-page="..."> based on
// the URL and inject a tiny <style> that hides the Canvas elements we're
// about to replace. The full extension logic runs in index.ts at
// document_idle when the DOM is stable.

function pageTypeFor(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.pathname === '/' || u.pathname === '') return 'dashboard';
    if (u.pathname.startsWith('/login')) return null;
    if (/\/courses\/\d+\/discussion_topics\/\d+/.test(u.pathname)) return 'discussion';
    if (/\/courses\/\d+\/discussion_topics\/?$/.test(u.pathname)) return 'discussions-list';
    if (/\/courses\/\d+\/assignments\/\d+/.test(u.pathname)) return 'assignment';
    if (/\/courses\/\d+\/assignments\/?$/.test(u.pathname)) return 'assignments';
    if (/\/courses\/\d+\/announcements\/?$/.test(u.pathname)) return 'announcements';
    if (/\/courses\/\d+\/modules\/?$/.test(u.pathname)) return 'modules';
    if (/\/courses\/\d+\/users\/?$/.test(u.pathname)) return 'people';
    if (/\/courses\/\d+\/grades\/?$/.test(u.pathname)) return 'grades';
    if (/\/courses\/\d+\/files(\b|\/|\?)/.test(u.pathname)) return 'files';
    if (/\/courses\/\d+\/quizzes\/?$/.test(u.pathname)) return 'quizzes';
    if (/\/calendar2?\/?$/.test(u.pathname)) return 'calendar';
    if (/\/conversations\/?(\?|$|#)/.test(u.pathname)) return 'inbox';
    if (/\/courses\/\d+\/?$/.test(u.pathname)) return 'home';
    return null;
  } catch { return null; }
}

const t = pageTypeFor(location.href);
if (t) document.documentElement.setAttribute('data-pb-page', t);

const style = document.createElement('style');
style.id = 'paintbrush-eager-style';
style.textContent = `
  html[data-pb-page]:not([data-pb-page=""]) #main,
  html[data-pb-page]:not([data-pb-page=""]) #content,
  html[data-pb-page]:not([data-pb-page=""]) .ic-Action-header,
  html[data-pb-page]:not([data-pb-page=""]) #breadcrumbs,
  html[data-pb-page]:not([data-pb-page=""]) .ic-app-crumbs,
  html[data-pb-page]:not([data-pb-page=""]) #wrapper > header,
  html[data-pb-page]:not([data-pb-page=""]) #left-side,
  html[data-pb-page]:not([data-pb-page=""]) #section-tabs,
  html[data-pb-page]:not([data-pb-page=""]) .immersive_reader_mount_point,
  html[data-pb-page]:not([data-pb-page=""]) [data-testid="immersive-reader-button"],
  html[data-pb-page]:not([data-pb-page=""]) [data-testid*="ImmersiveReader" i],
  html[data-pb-page]:not([data-pb-page=""]) button[aria-label*="Immersive Reader" i],
  html[data-pb-page]:not([data-pb-page=""]) a[aria-label*="Immersive Reader" i],
  html[data-pb-page]:not([data-pb-page=""]) .ImmersiveReaderButton,
  html[data-pb-page]:not([data-pb-page=""]) #syllabus_navigation,
  html[data-pb-page]:not([data-pb-page=""]) #syllabus_nav,
  html[data-pb-page]:not([data-pb-page=""]) .syllabus-navigation,
  html[data-pb-page]:not([data-pb-page=""]) #wrapper > #header,
  html[data-pb-page]:not([data-pb-page=""]) #ic-mobile-toolbar,
  html[data-pb-page]:not([data-pb-page=""]) #paintbrush-canvas-slot,
  html[data-pb-page]:not([data-pb-page=""]) #right-side-wrapper,
  html[data-pb-page]:not([data-pb-page=""]) #right-side {
    display: none !important;
  }
  html[data-pb-page]:not([data-pb-page=""]) body {
    background: #fafafa !important;
  }
  /* Expanded nav drawer — show #left-side as a floating overlay */
  html[data-pb-nav-expanded="true"] #left-side {
    display: block !important;
    position: fixed !important;
    top: 52px !important;
    left: 80px !important;
    width: 240px !important;
    max-height: calc(100vh - 64px) !important;
    overflow-y: auto !important;
    z-index: 2147483645 !important;
    background: rgba(255, 255, 255, 0.98) !important;
    border: 1px solid rgb(228 228 231) !important;
    border-radius: 12px !important;
    box-shadow: 0 12px 36px rgba(0,0,0,0.12) !important;
    padding: 8px !important;
    backdrop-filter: blur(12px) saturate(150%) !important;
  }
  html[data-pb-nav-expanded="true"] #left-side #section-tabs,
  html[data-pb-nav-expanded="true"] #left-side .ic-app-course-menu {
    display: block !important;
  }
`;
(document.head || document.documentElement).appendChild(style);

console.log('[Paintbrush:eager]', 'data-pb-page =', t ?? '(none)');
