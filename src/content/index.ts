import { mountSidebar } from './inject/mount';
import { watchAndInject, isFilesPage, isModulesPage } from './inject/buttons';

let unmount: (() => void) | null = null;

async function init() {
  unmount = await mountSidebar();

  watchAndInject(
    {
      id: 'paintbrush-download-files-btn',
      label: '⬇ Download all files (.zip)',
      onClick: (courseId) => {
        console.log('[Paintbrush] files download requested for course', courseId);
        alert('Files download coming next task.');
      }
    },
    () => isFilesPage(location.href)
  );

  watchAndInject(
    {
      id: 'paintbrush-export-modules-btn',
      label: '⬇ Export modules (.zip)',
      onClick: (courseId) => {
        console.log('[Paintbrush] modules export requested for course', courseId);
        alert('Modules export coming next task.');
      }
    },
    () => isModulesPage(location.href)
  );
}

init().catch((err) => console.error('[Paintbrush]', err));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'TOGGLE_SIDEBAR') {
    document.dispatchEvent(new CustomEvent('paintbrush:toggle'));
  }
});
