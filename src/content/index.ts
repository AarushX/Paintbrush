import { mountSidebar } from './inject/mount';
import { watchAndInject, isFilesPage, isModulesPage, isCourseRootPage } from './inject/buttons';
import { downloadAllFiles } from './downloader/files';
import { exportModules } from './downloader/modules';
import { exportEntireCourse } from './downloader/course';
import { parseDiscussionFromUrl } from '../lib/course-context';
import { mountDiscussionViewer } from './discussion/inject';

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

  syncDiscussionMount();
  // Re-check on SPA navigation (Canvas changes URLs without full reload)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      syncDiscussionMount();
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
