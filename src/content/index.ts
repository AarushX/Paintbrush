import { mountSidebar } from './inject/mount';
import { watchAndInject, isFilesPage, isModulesPage, isCourseRootPage } from './inject/buttons';
import { downloadAllFiles } from './downloader/files';
import { exportModules } from './downloader/modules';
import { exportEntireCourse } from './downloader/course';

let unmount: (() => void) | null = null;

async function init() {
  if (location.pathname.startsWith('/login')) return;

  unmount = await mountSidebar();

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
