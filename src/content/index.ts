console.log('[Paintbrush] content script loaded on', location.href);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'TOGGLE_SIDEBAR') {
    console.log('[Paintbrush] toggle sidebar requested');
  }
});
