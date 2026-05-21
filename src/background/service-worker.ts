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

// ---------------------------------------------------------------------------
// Document preview: resolve a file's underlying canvadoc PDF URL.
//
// Canvas previews docs via `file_preview` → `canvadoc_session` → a
// canvadocs.instructure.com DocViewer session. The DocViewer is a heavy
// React app that doesn't fit pages to width by default. The session also
// exposes the raw converted PDF, which Chrome's native PDF viewer CAN fit
// to width (`#view=FitH`). Tracing that cross-origin redirect chain needs a
// privileged (non-CORS) fetch, so it runs here in the background worker.
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'PB_RESOLVE_DOC_PDF') {
    resolveDocPdf(msg.origin, msg.courseId, msg.fileId)
      .then(sendResponse)
      .catch(() => sendResponse({ pdfUrl: null }));
    return true; // keep the message channel open for the async response
  }
  return false;
});

async function resolveDocPdf(
  origin: string,
  courseId: number,
  fileId: number
): Promise<{ pdfUrl: string | null }> {
  try {
    // Follows: file_preview 302→ canvadoc_session 302→
    // canvadocs.instructure.com/1/sessions/{token}/view
    const res = await fetch(
      `${origin}/courses/${courseId}/files/${fileId}/file_preview?annotate=0`,
      { credentials: 'include', redirect: 'follow' }
    );
    const m = res.url.match(/^(https:\/\/[^/]+\/\d+\/sessions\/[^/]+)\/view/);
    if (!m) return { pdfUrl: null };
    // The session's converted PDF lives alongside the /view page.
    return { pdfUrl: `${m[1]}/file/file.pdf` };
  } catch {
    return { pdfUrl: null };
  }
}

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
