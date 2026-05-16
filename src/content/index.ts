import { mountSidebar } from './inject/mount';

let unmount: (() => void) | null = null;

async function init() {
  unmount = await mountSidebar();
}

init().catch((err) => console.error('[Paintbrush]', err));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'TOGGLE_SIDEBAR') {
    document.dispatchEvent(new CustomEvent('paintbrush:toggle'));
  }
});
