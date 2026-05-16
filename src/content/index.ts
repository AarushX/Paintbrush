import { mountSidebar } from './inject/mount';
import { watchAndInject, isFilesPage, isModulesPage, isCourseRootPage } from './inject/buttons';
import { downloadAllFiles } from './downloader/files';
import { exportModules } from './downloader/modules';
import { exportEntireCourse } from './downloader/course';
import { parseDiscussionFromUrl, parseCourseFromUrl, parseAssignmentFromUrl, isAssignmentListPage, isAnnouncementsListPage } from '../lib/course-context';
import { mountDiscussionViewer } from './discussion/inject';
import { mountAssignmentViewer } from './assignment/inject';
import { mountAnnouncementList } from './announcement/inject';

let unmount: (() => void) | null = null;

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

  // Re-check on SPA navigation (Canvas changes URLs without full reload)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      syncDiscussionMount();
      syncAssignmentMount();
      syncAnnouncementMount();
    }
  }, 500);

  watchAndInject(
    {
      id: 'paintbrush-download-files-btn',
      label: '⬇ Download all files (.zip)',
      onClick: (courseId) => downloadAllFiles(courseId)
    },
    () => isFilesPage(location.href)
  );

  watchAndInject(
    {
      id: 'paintbrush-export-modules-btn',
      label: '⬇ Export modules (.zip)',
      onClick: (courseId) => exportModules(courseId)
    },
    () => isModulesPage(location.href)
  );

  watchAndInject(
    {
      id: 'paintbrush-export-course-btn',
      label: '⬇ Export entire course (.zip)',
      onClick: (courseId) => exportEntireCourse(courseId)
    },
    () => isCourseRootPage(location.href)
  );
}

init().catch((err) => console.error('[Paintbrush]', err));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'TOGGLE_SIDEBAR') {
    document.dispatchEvent(new CustomEvent('paintbrush:toggle'));
  }
});
