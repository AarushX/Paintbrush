// chrome.storage.session is gated to trusted contexts by default; opening it
// to content scripts is required for our planner cache.
chrome.storage.session
  .setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
  .catch(() => {});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
  } catch {
    // Content script not loaded on this tab (e.g. chrome:// page) — ignore.
  }
});

chrome.runtime.onStartup.addListener(restoreCustomScripts);
chrome.runtime.onInstalled.addListener(restoreCustomScripts);

async function restoreCustomScripts() {
  const { customDomains = [] } = await chrome.storage.local.get('customDomains');
  for (const d of customDomains as string[]) {
    const origin = `*://${d}/*`;
    try {
      await chrome.scripting.registerContentScripts([{
        id: `paintbrush-${d}`,
        matches: [origin],
        js: ['src/content/index.ts'],
        runAt: 'document_idle'
      }]);
    } catch {
      // already registered
    }
  }
}
