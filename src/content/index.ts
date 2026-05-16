import { mountSidebar } from './inject/mount';
import { parseDiscussionFromUrl, parseCourseFromUrl, parseAssignmentFromUrl, isAssignmentListPage, isAnnouncementsListPage } from '../lib/course-context';
import { mountDiscussionViewer } from './discussion/inject';
import { mountAssignmentViewer } from './assignment/inject';
import { mountAnnouncementList } from './announcement/inject';
// === modules/people additions ===
import { isModulesListPage, isPeoplePage } from '../lib/course-context';
import { mountModulesViewer } from './modules/inject';
import { mountPeopleViewer } from './people/inject';
// === grades/home additions ===
import { isGradesPage, isCourseHomePage } from '../lib/course-context';
import { mountGradesViewer } from './grades/inject';
import { mountHomeViewer } from './home/inject';
// === discussions-list/modules-fix additions ===
import { isDiscussionsListPage } from '../lib/course-context';
import { mountDiscussionList } from './discussion-list/inject';

let unmount: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Eager FOUC suppression. We register at document_start, so we run BEFORE
// Canvas paints anything. We tag <html> with a data-attribute identifying the
// page type. The skin CSS (loaded by skin/inject.ts later) has rules keyed to
// these attributes that hide Canvas's content for pages we replace, so the
// user never sees the default Canvas page flash before our viewer mounts.
// ---------------------------------------------------------------------------

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

function applyEagerHide() {
  const t = pageTypeFor(location.href);
  if (t) document.documentElement.setAttribute('data-pb-page', t);
  else document.documentElement.removeAttribute('data-pb-page');
}
applyEagerHide();

// Inject minimal FOUC-blocking CSS as soon as <html> exists. This runs at
// document_start (per manifest), BEFORE Canvas paints, so the user never
// sees the default Canvas page flash before our viewer mounts.
(function injectEagerStyle() {
  if (document.getElementById('paintbrush-eager-style')) return;
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
    html[data-pb-page]:not([data-pb-page=""]) #section-tabs {
      display: none !important;
    }
    html[data-pb-page]:not([data-pb-page=""]) body {
      background: #fafafa !important;
    }
    /* When the user explicitly expands our nav drawer, show #left-side
       as a floating overlay anchored next to the global nav. #section-tabs
       sits naturally inside it. */
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
})();

// Floating nav-drawer toggle button. Visible only on viewer pages.
// Clicking it expands/retracts the (otherwise hidden) Canvas section-tabs
// as a floating overlay so the user can still jump between course sections
// without Canvas's slow native sidebar reflowing the page.
function ensureNavToggle() {
  if (document.getElementById('paintbrush-nav-toggle')) return;
  if (!document.body) return;
  const btn = document.createElement('button');
  btn.id = 'paintbrush-nav-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Toggle course navigation');
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
  btn.style.cssText = [
    'position: fixed', 'top: 12px', 'left: 80px',
    'z-index: 2147483646',
    'width: 32px', 'height: 32px',
    'display: none', // shown via CSS only on viewer pages
    'align-items: center', 'justify-content: center',
    'border-radius: 8px',
    'background: rgba(255, 255, 255, 0.94)',
    'border: 1px solid rgb(228 228 231)',
    'box-shadow: 0 2px 6px rgba(0,0,0,0.06)',
    'color: rgb(63 63 70)',
    'cursor: pointer',
    'transition: background-color 140ms ease, transform 100ms ease',
    'backdrop-filter: blur(6px)'
  ].join(';');
  btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255, 255, 255, 1)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255, 255, 255, 0.94)'; });
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-pb-nav-expanded') === 'true';
    if (cur) document.documentElement.removeAttribute('data-pb-nav-expanded');
    else document.documentElement.setAttribute('data-pb-nav-expanded', 'true');
  });
  document.body.appendChild(btn);

  // Show/hide via CSS based on whether we're on a viewer page
  const toggleStyle = document.createElement('style');
  toggleStyle.textContent = `
    html[data-pb-page]:not([data-pb-page=""]) #paintbrush-nav-toggle { display: inline-flex !important; }
    html:not([data-pb-page]) #paintbrush-nav-toggle,
    html[data-pb-page=""] #paintbrush-nav-toggle { display: none !important; }
    /* Close the drawer when clicking elsewhere */
    html[data-pb-nav-expanded="true"] #paintbrush-nav-toggle {
      background: rgb(63 63 70) !important;
      color: white !important;
    }
  `;
  (document.head || document.documentElement).appendChild(toggleStyle);
}

// Wait for body before doing anything else
function whenBodyReady(fn: () => void) {
  if (document.body) fn();
  else document.addEventListener('DOMContentLoaded', fn, { once: true });
}

async function init() {
  if (location.pathname.startsWith('/login')) return;

  unmount = await mountSidebar();

  let discussionCleanup: (() => void) | null = null;
  let lastDiscussionKey: string | null = null;

  function syncDiscussionMount() {
    const ids = parseDiscussionFromUrl(location.href);
    const key = ids ? `${ids.courseId}:${ids.topicId}` : null;
    if (key === lastDiscussionKey) return;
    if (discussionCleanup) {
      discussionCleanup();
      discussionCleanup = null;
    }
    lastDiscussionKey = key;
    if (ids) {
      // Wait one frame for Canvas's DOM to render its container, then take over.
      requestAnimationFrame(() => {
        discussionCleanup = mountDiscussionViewer(ids.courseId, ids.topicId);
      });
    }
  }

  let assignmentCleanup: (() => void) | null = null;
  let lastAssignmentKey: string | null = null;

  function syncAssignmentMount() {
    const detail = parseAssignmentFromUrl(location.href);
    let key: string | null = null;
    if (detail) key = `detail:${detail.courseId}:${detail.assignmentId}`;
    else if (isAssignmentListPage(location.href)) {
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) key = `list:${cid}`;
    }
    if (key === lastAssignmentKey) return;
    if (assignmentCleanup) { assignmentCleanup(); assignmentCleanup = null; }
    lastAssignmentKey = key;
    if (!key) return;
    requestAnimationFrame(() => {
      if (detail) {
        assignmentCleanup = mountAssignmentViewer({ kind: 'detail', courseId: detail.courseId, assignmentId: detail.assignmentId });
      } else {
        const cid = parseCourseFromUrl(location.href);
        if (cid != null) {
          assignmentCleanup = mountAssignmentViewer({ kind: 'list', courseId: cid });
        }
      }
    });
  }

  let announcementCleanup: (() => void) | null = null;
  let lastAnnouncementKey: string | null = null;

  function syncAnnouncementMount() {
    let key: string | null = null;
    if (isAnnouncementsListPage(location.href)) {
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) key = `${cid}`;
    }
    if (key === lastAnnouncementKey) return;
    if (announcementCleanup) { announcementCleanup(); announcementCleanup = null; }
    lastAnnouncementKey = key;
    if (!key) return;
    requestAnimationFrame(() => {
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) announcementCleanup = mountAnnouncementList(cid);
    });
  }

  syncDiscussionMount();
  syncAssignmentMount();
  syncAnnouncementMount();

  // === modules/people additions ===
  let modulesCleanup: (() => void) | null = null;
  let lastModulesKey: string | null = null;

  function syncModulesMount() {
    let key: string | null = null;
    if (isModulesListPage(location.href)) {
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) key = String(cid);
    }
    if (key === lastModulesKey) return;
    if (modulesCleanup) { modulesCleanup(); modulesCleanup = null; }
    lastModulesKey = key;
    if (!key) return;
    requestAnimationFrame(() => {
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) modulesCleanup = mountModulesViewer(cid);
    });
  }

  let peopleCleanup: (() => void) | null = null;
  let lastPeopleKey: string | null = null;

  function syncPeopleMount() {
    let key: string | null = null;
    if (isPeoplePage(location.href)) {
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) key = String(cid);
    }
    if (key === lastPeopleKey) return;
    if (peopleCleanup) { peopleCleanup(); peopleCleanup = null; }
    lastPeopleKey = key;
    if (!key) return;
    requestAnimationFrame(() => {
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) peopleCleanup = mountPeopleViewer(cid);
    });
  }

  syncModulesMount();
  syncPeopleMount();

  // === grades/home additions ===
  let gradesCleanup: (() => void) | null = null;
  let lastGradesKey: string | null = null;
  function syncGradesMount() {
    let key: string | null = null;
    if (isGradesPage(location.href)) {
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) key = String(cid);
    }
    if (key === lastGradesKey) return;
    if (gradesCleanup) { gradesCleanup(); gradesCleanup = null; }
    lastGradesKey = key;
    if (!key) return;
    requestAnimationFrame(() => {
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) gradesCleanup = mountGradesViewer(cid);
    });
  }

  let homeCleanup: (() => void) | null = null;
  let lastHomeKey: string | null = null;
  function syncHomeMount() {
    let key: string | null = null;
    if (isCourseHomePage(location.href)) {
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) key = String(cid);
    }
    if (key === lastHomeKey) return;
    if (homeCleanup) { homeCleanup(); homeCleanup = null; }
    lastHomeKey = key;
    if (!key) return;
    requestAnimationFrame(() => {
      const cid = parseCourseFromUrl(location.href);
      if (cid != null) homeCleanup = mountHomeViewer(cid);
    });
  }

  syncGradesMount();
  syncHomeMount();

  // Re-check on SPA navigation (Canvas changes URLs without full reload)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      syncDiscussionMount();
      syncAssignmentMount();
      syncAnnouncementMount();
      syncModulesMount();
      syncPeopleMount();
      syncGradesMount();
      syncHomeMount();
      syncDiscussionListMount();
      syncDashboardMount();
      syncCalendarMount();
      syncInboxMount();
      syncFilesMount();
      syncQuizzesMount();
    }
  }, 500);

}

whenBodyReady(() => {
  ensureNavToggle();
  init().catch((err) => console.error('[Paintbrush]', err));
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'TOGGLE_SIDEBAR') {
    document.dispatchEvent(new CustomEvent('paintbrush:toggle'));
  }
});

// Keep the page-type attribute synced on SPA navigation. Polls every 250ms;
// cheap because applyEagerHide is just a string comparison + setAttribute.
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    applyEagerHide();
  }
}, 250);

// === discussions-list/modules-fix additions ===
let discussionListCleanup: (() => void) | null = null;
let lastDiscussionListKey: string | null = null;
function syncDiscussionListMount() {
  let key: string | null = null;
  if (isDiscussionsListPage(location.href)) {
    const cid = parseCourseFromUrl(location.href);
    if (cid != null) key = String(cid);
  }
  if (key === lastDiscussionListKey) return;
  if (discussionListCleanup) { discussionListCleanup(); discussionListCleanup = null; }
  lastDiscussionListKey = key;
  if (!key) return;
  requestAnimationFrame(() => {
    const cid = parseCourseFromUrl(location.href);
    if (cid != null) discussionListCleanup = mountDiscussionList(cid);
  });
}

syncDiscussionListMount();

// === skin additions ===
import { applyCanvasSkin } from './skin/inject';

applyCanvasSkin();

// === dashboard additions ===
import { isDashboardPage } from '../lib/course-context';
import { mountDashboardViewer } from './dashboard/inject';

let dashboardCleanup: (() => void) | null = null;
let lastDashboardKey: string | null = null;
function syncDashboardMount() {
  const key = isDashboardPage(location.href) ? 'dashboard' : null;
  if (key === lastDashboardKey) return;
  if (dashboardCleanup) { dashboardCleanup(); dashboardCleanup = null; }
  lastDashboardKey = key;
  if (!key) return;
  requestAnimationFrame(() => {
    dashboardCleanup = mountDashboardViewer();
  });
}

syncDashboardMount();

// === calendar additions ===
import { isCalendarPage } from '../lib/course-context';
import { mountCalendarViewer } from './calendar/inject';

let calendarCleanup: (() => void) | null = null;
let lastCalendarKey: string | null = null;
function syncCalendarMount() {
  const key = isCalendarPage(location.href) ? 'calendar' : null;
  if (key === lastCalendarKey) return;
  if (calendarCleanup) { calendarCleanup(); calendarCleanup = null; }
  lastCalendarKey = key;
  if (!key) return;
  requestAnimationFrame(() => { calendarCleanup = mountCalendarViewer(); });
}

syncCalendarMount();

// === inbox additions ===
import { isInboxPage } from '../lib/course-context';
import { mountInboxViewer } from './inbox/inject';

let inboxCleanup: (() => void) | null = null;
let lastInboxKey: string | null = null;
function syncInboxMount() {
  const key = isInboxPage(location.href) ? 'inbox' : null;
  if (key === lastInboxKey) return;
  if (inboxCleanup) { inboxCleanup(); inboxCleanup = null; }
  lastInboxKey = key;
  if (!key) return;
  requestAnimationFrame(() => { inboxCleanup = mountInboxViewer(); });
}

syncInboxMount();

// === files+quizzes viewer additions ===
import { isFilesPage as isFilesViewerPage, parseFilesFolderPath, isQuizzesListPage } from '../lib/course-context';
import { mountFilesViewer } from './files/inject';
import { mountQuizzesViewer } from './quizzes/inject';

let filesCleanup: (() => void) | null = null;
let lastFilesKey: string | null = null;
function syncFilesMount() {
  const parsed = parseFilesFolderPath(location.href);
  let key: string | null = null;
  if (parsed && isFilesViewerPage(location.href)) key = `${parsed.courseId}:${parsed.folderPath}`;
  if (key === lastFilesKey) return;
  if (filesCleanup) { filesCleanup(); filesCleanup = null; }
  lastFilesKey = key;
  if (!key || !parsed) return;
  requestAnimationFrame(() => {
    filesCleanup = mountFilesViewer(parsed.courseId, parsed.folderPath);
  });
}

let quizzesCleanup: (() => void) | null = null;
let lastQuizzesKey: string | null = null;
function syncQuizzesMount() {
  let key: string | null = null;
  if (isQuizzesListPage(location.href)) {
    const cid = parseCourseFromUrl(location.href);
    if (cid != null) key = String(cid);
  }
  if (key === lastQuizzesKey) return;
  if (quizzesCleanup) { quizzesCleanup(); quizzesCleanup = null; }
  lastQuizzesKey = key;
  if (!key) return;
  requestAnimationFrame(() => {
    const cid = parseCourseFromUrl(location.href);
    if (cid != null) quizzesCleanup = mountQuizzesViewer(cid);
  });
}

syncFilesMount();
syncQuizzesMount();
