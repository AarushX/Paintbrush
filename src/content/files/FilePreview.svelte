<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchFileDetail, fetchFolder, fetchFolderFiles } from './api';
  import { downloadFileFromUrl } from '../downloader/zip';
  import type { FileFull, FolderFull } from '../../lib/types';

  let {
    courseId,
    fileId,
    onShowCanvas,
    embedded = false,
    hostId = 'paintbrush-file-preview-root',
    backLabel = 'Files',
    onClose
  }: {
    courseId: number;
    fileId: number;
    onShowCanvas?: () => void;
    /** When true, FilePreview is rendered inside another viewer (Files /
     *  Modules) rather than as its own page mount. Back navigation calls
     *  onClose instead of history.back(). */
    embedded?: boolean;
    /** id of the shadow-DOM host that focus mode should expand. */
    hostId?: string;
    backLabel?: string;
    onClose?: () => void;
  } = $props();

  // The viewer can switch between files in the same folder without
  // remounting. `activeFileId` is what's actually displayed; `fileId`
  // is just the initial value the host mounted with.
  let activeFileId = $state(fileId);

  // ---- Core file state ----
  let file = $state<FileFull | null>(null);
  let folder = $state<FolderFull | null>(null);
  let siblingFiles = $state<FileFull[]>([]);
  let loading = $state(true);
  let error = $state('');
  let textContent = $state('');
  let isText = $state(false);
  let copyStatus = $state('Copy');

  // ---- Download state ----
  let downloading = $state(false);
  let downloadError = $state('');

  // ---- Immersive Document Deck state ----
  let filterMode = $state<'original' | 'dark' | 'sepia'>('original');
  let focusMode = $state(false);
  let showSidebar = $state(false);
  let copiedId = $state<string | null>(null);

  async function handleDownload() {
    if (!file || downloading) return;
    downloading = true; downloadError = '';
    try {
      await downloadFileFromUrl(file.url, file.display_name);
    } catch (err) {
      downloadError = err instanceof Error ? err.message : String(err);
    } finally {
      downloading = false;
    }
  }

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function fileIcon(name: string): string {
    const ext = name.toLowerCase().split('.').pop() ?? '';
    if (['jpg','jpeg','png','gif','webp','svg','heic'].includes(ext)) return '🖼';
    if (['mp4','mov','avi','webm','mkv'].includes(ext)) return '🎬';
    if (['mp3','wav','aac','flac','m4a'].includes(ext)) return '🎵';
    if (['zip','tar','gz','rar','7z'].includes(ext)) return '📦';
    if (['pdf'].includes(ext)) return '📕';
    if (['doc','docx','rtf'].includes(ext)) return '📝';
    if (['xls','xlsx','csv'].includes(ext)) return '📊';
    if (['ppt','pptx'].includes(ext)) return '📈';
    return '📄';
  }

  function getFileType(name: string): 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'other' {
    const ext = name.toLowerCase().split('.').pop() ?? '';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['jpg','jpeg','png','gif','webp','svg','heic'].includes(ext)) return 'image';
    if (['mp4','mov','avi','webm','mkv'].includes(ext)) return 'video';
    if (['mp3','wav','aac','flac','m4a'].includes(ext)) return 'audio';
    if (['txt','js','ts','py','java','cpp','c','h','css','html','json','md','yaml','yml','sh','bat','sql'].includes(ext)) return 'text';
    return 'other';
  }

  const fileType = $derived(file ? getFileType(file.display_name) : 'other');
  const icon = $derived(file ? fileIcon(file.display_name) : '📄');
  const sizeStr = $derived(file ? fmtSize(file.size) : '');
  const displayName = $derived(file ? file.display_name : 'Loading File…');
  const fileUrl = $derived(file ? file.url : '');
  const contentType = $derived(file ? (file.content_type ?? 'Unknown') : 'Unknown');
  const updateDateStr = $derived(file && file.updated_at ? new Date(file.updated_at).toLocaleString() : '');
  const createdDateStr = $derived(file && file.created_at ? new Date(file.created_at).toLocaleString() : '');

  // Course-files folder path (drop the leading "course files" segment).
  const folderPath = $derived(
    folder ? (folder.full_name?.split('/').slice(1).join(' / ') || 'Course files') : ''
  );

  // Documents (PDF + Office formats) preview through Canvas's own
  // `file_preview` endpoint — the exact path Canvas's native files page
  // uses. It 302-redirects to a *freshly minted* canvadoc / DocViewer
  // session, so it works for large PowerPoint / Word files that don't
  // carry a pre-baked session URL on the file's HTML page. Generating a
  // fresh session each time also avoids the "still processing" stall
  // caused by loading a stale or expired scraped session URL.
  const docExt = $derived.by(() => {
    if (!file) return false;
    const ext = file.display_name.toLowerCase().split('.').pop() ?? '';
    return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'ods', 'odp'].includes(ext);
  });
  const isPreviewableDoc = $derived(docExt);

  // The background worker traces the canvadoc redirect chain to the file's
  // underlying converted PDF. Rendering that PDF in Chrome's native viewer
  // lets us request fit-to-width (`#view=FitH`) so a slide / page fills the
  // frame by default — something the canvadoc DocViewer app won't do.
  let pdfUrl = $state<string | null>(null);
  let docResolved = $state(false);

  // file_preview DocViewer fallback, used when PDF resolution fails.
  const docPreviewUrl = $derived(
    `/courses/${courseId}/files/${activeFileId}/file_preview?annotate=0`
  );
  // FitH = fit page width; one slide / page is maximised in the frame.
  const docIframeSrc = $derived(
    pdfUrl ? `${pdfUrl}#view=FitH&toolbar=1` : docPreviewUrl
  );

  async function resolvePdf(fid: number) {
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'PB_RESOLVE_DOC_PDF',
        origin: location.origin,
        courseId,
        fileId: fid
      });
      if (activeFileId !== fid) return; // user switched files mid-resolve
      pdfUrl = resp?.pdfUrl ?? null;
    } catch {
      if (activeFileId === fid) pdfUrl = null;
    } finally {
      if (activeFileId === fid) docResolved = true;
    }
  }

  // Reading filter → CSS filter string applied to the document surface.
  const filterCss = $derived(
    filterMode === 'dark'  ? 'invert(0.9) hue-rotate(180deg) contrast(1.1) saturate(1.1)' :
    filterMode === 'sepia' ? 'sepia(0.4) contrast(0.95)' :
    'none'
  );

  // ---- Focus Mode: expand the host container to the full viewport ----
  let savedHostLeft: string | null = null;
  let savedHostRight: string | null = null;

  function getHost(): HTMLElement | null {
    return document.getElementById(hostId);
  }

  $effect(() => {
    const host = getHost();
    if (!host) return;
    if (focusMode) {
      if (savedHostLeft === null) {
        savedHostLeft = host.style.left;
        savedHostRight = host.style.right;
      }
      host.style.transition = 'left 300ms cubic-bezier(0.22,0.61,0.36,1), right 300ms cubic-bezier(0.22,0.61,0.36,1)';
      host.style.left = '0px';
      host.style.right = '0px';
    } else if (savedHostLeft !== null) {
      host.style.left = savedHostLeft;
      host.style.right = savedHostRight ?? '';
      savedHostLeft = null;
      savedHostRight = null;
    }
  });

  async function load() {
    loading = true; error = '';
    textContent = ''; isText = false;
    const loadingFileId = activeFileId;
    try {
      file = await fetchFileDetail(loadingFileId);
      if (file) {
        const type = getFileType(file.display_name);
        if (type === 'text') {
          isText = true;
          const res = await fetch(file.url, { credentials: 'include' });
          if (res.ok) textContent = await res.text();
          else isText = false;
        }
        // For document files, resolve the underlying PDF so it can render
        // fit-to-width in Chrome's native viewer.
        const ext = file.display_name.toLowerCase().split('.').pop() ?? '';
        if (['pdf','doc','docx','xls','xlsx','ppt','pptx','rtf','odt','ods','odp'].includes(ext)) {
          pdfUrl = null;
          docResolved = false;
          resolvePdf(loadingFileId);
        } else {
          docResolved = true;
        }
        // Folder info + sibling files for the metadata sidebar — non-fatal.
        if (file.folder_id != null) {
          const fid = file.folder_id;
          fetchFolder(fid).then(f => { folder = f; }).catch(() => {});
          fetchFolderFiles(fid)
            .then(list => { siblingFiles = list.filter(f => !f.hidden); })
            .catch(() => {});
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  // Switch the viewer to a different file in the same folder. Stays
  // inside the component — no remount, no URL change (which would
  // trip index.ts's file-preview sync into a hard remount).
  function switchFile(id: number) {
    if (id === activeFileId) return;
    activeFileId = id;
    file = null;
    folder = null;
    pdfUrl = null;
    docResolved = false;
    load();
  }

  onMount(() => {
    load();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) focusMode = false;
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      // Restore host geometry if we unmount while in focus mode.
      const host = getHost();
      if (host && savedHostLeft !== null) {
        host.style.left = savedHostLeft;
        host.style.right = savedHostRight ?? '';
      }
    };
  });

  function goBack() {
    if (embedded && onClose) { onClose(); return; }
    // Go straight to the Files page. history.back() would only step back
    // one entry, so opening several files in a row (each a pushState)
    // would otherwise need multiple clicks to escape the viewer.
    window.location.href = `/courses/${courseId}/files`;
  }

  function copyText() {
    navigator.clipboard.writeText(textContent);
    copyStatus = 'Copied!';
    setTimeout(() => { copyStatus = 'Copy'; }, 2000);
  }

  function copyId(label: string, value: string | number) {
    navigator.clipboard.writeText(String(value)).catch(() => {});
    copiedId = label;
    setTimeout(() => { if (copiedId === label) copiedId = null; }, 1500);
  }

  const FILTERS: Array<{ id: 'original' | 'dark' | 'sepia'; label: string; icon: string }> = [
    { id: 'original', label: 'Original', icon: '○' },
    { id: 'dark', label: 'Night', icon: '☾' },
    { id: 'sepia', label: 'Sepia', icon: '◐' }
  ];
</script>

<div class={`${embedded ? 'absolute inset-0' : 'h-screen w-full'} bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans flex flex-col overflow-hidden`}>
  <!-- ============ Frosted-glass toolbar ============ -->
  {#if !focusMode}
    <header class="h-16 border-b border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md flex items-center justify-between px-5 z-20 flex-shrink-0">
      <!-- Left: back + title -->
      <div class="flex items-center gap-3 min-w-0">
        <button onclick={goBack}
                class="px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors active:scale-95 flex items-center gap-1.5 text-xs font-medium"
                aria-label={`Back to ${backLabel}`}>
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          {backLabel}
        </button>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-lg flex-shrink-0">{icon}</span>
            <h1 class="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-50">{displayName}</h1>
          </div>
          {#if file}
            <div class="text-[11px] text-zinc-500 dark:text-zinc-400">
              {sizeStr}{#if updateDateStr} · Updated {new Date(file.updated_at ?? '').toLocaleDateString()}{/if}
            </div>
          {:else}
            <div class="text-[11px] text-zinc-400">Loading file details…</div>
          {/if}
        </div>
      </div>

      <!-- Center/right: deck tools -->
      <div class="flex items-center gap-2">
        {#if file}
          <!-- Reading-filter segmented control -->
          <div class="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
            {#each FILTERS as f}
              <button onclick={() => filterMode = f.id}
                      class={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-200 active:scale-95 flex items-center gap-1 ${filterMode === f.id
                        ? 'shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                      style={filterMode === f.id
                        ? 'background: var(--pb-brand); color: var(--pb-brand-fg);'
                        : ''}
                      title={`${f.label} reading`}>
                <span class="text-[12px] leading-none">{f.icon}</span>
                <span class="hidden sm:inline">{f.label}</span>
              </button>
            {/each}
          </div>

          <!-- Focus -->
          <button onclick={() => focusMode = true}
                  class="px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-[var(--pb-brand)] hover:text-[var(--pb-brand-strong)] transition-all active:scale-95 flex items-center gap-1.5"
                  title="Focus mode — fill the screen">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
            <span class="hidden sm:inline">Focus</span>
          </button>

          <!-- Info / sidebar toggle -->
          <button onclick={() => showSidebar = !showSidebar}
                  class={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-all active:scale-95 flex items-center gap-1.5 ${showSidebar
                    ? 'text-[var(--pb-brand-fg)]'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-[var(--pb-brand)]'}`}
                  style={showSidebar ? 'background: var(--pb-brand); border-color: var(--pb-brand);' : ''}
                  title="Document details">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="hidden sm:inline">Info</span>
          </button>

          <div class="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-0.5"></div>

          <!-- Download -->
          <button type="button" onclick={handleDownload} disabled={downloading}
                  class="px-3 py-1.5 text-xs font-medium rounded-lg active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60"
                  style="background: var(--pb-brand); color: var(--pb-brand-fg);"
                  title={downloadError || 'Download file'}>
            <svg class={`w-3.5 h-3.5 ${downloading ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            {downloading ? 'Downloading…' : 'Download'}
          </button>

          {#if onShowCanvas}
            <button onclick={onShowCanvas}
                    class="px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
              Canvas View
            </button>
          {/if}
        {/if}
      </div>
    </header>
  {/if}

  <!-- ============ Body: document deck + sidebar ============ -->
  <div class="flex-1 w-full relative overflow-hidden flex">
    <!-- Primary document frame -->
    <div class="flex-1 relative overflow-hidden bg-zinc-100 dark:bg-zinc-900 transition-all duration-300">
      {#if loading}
        <div class="absolute inset-0 flex items-center justify-center flex-col gap-3">
          <div class="w-8 h-8 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-[var(--pb-brand)] animate-spin"></div>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">Loading document viewer…</p>
        </div>
      {:else if error}
        <div class="max-w-md mx-auto mt-16 p-6 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 text-center">
          <span class="text-3xl block mb-3">⚠️</span>
          <h2 class="text-base font-semibold text-red-800 dark:text-red-400 mb-2">Failed to load file</h2>
          <p class="text-xs text-red-600 dark:text-red-300 mb-4">{error}</p>
          <button onclick={load} class="px-4 py-2 text-xs font-semibold rounded bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors">
            Retry Loading
          </button>
        </div>
      {:else if file}
        {#if fileType === 'image'}
          <div class="absolute inset-0 flex items-center justify-center p-6 bg-zinc-950/95 dark:bg-black/95">
            <img src={fileUrl} alt={displayName}
                 class="max-h-full max-w-full rounded-md shadow-2xl object-contain border border-zinc-800/40 select-none animate-fade-in"
                 style={`filter: ${filterCss};`} />
          </div>

        {:else if fileType === 'video'}
          <div class="absolute inset-0 flex items-center justify-center p-6 bg-zinc-950/95 dark:bg-black/95">
            <video src={fileUrl} controls autoplay
                   class="max-h-full max-w-full rounded-lg shadow-2xl border border-zinc-800/40">
              <track kind="captions" />
            </video>
          </div>

        {:else if fileType === 'audio'}
          <div class="absolute inset-0 flex items-center justify-center p-6 bg-zinc-950/20 dark:bg-black/40">
            <div class="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-6 flex flex-col items-center gap-6">
              <div class="w-24 h-24 rounded-full bg-[var(--pb-brand-soft)] text-4xl flex items-center justify-center shadow-inner animate-pulse">🎵</div>
              <div class="text-center w-full">
                <h2 class="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100">{displayName}</h2>
                <p class="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">{sizeStr} · Audio File</p>
              </div>
              <audio src={fileUrl} controls autoplay class="w-full mt-2"></audio>
            </div>
          </div>

        {:else if fileType === 'text'}
          <div class="absolute inset-0 flex flex-col bg-zinc-900 text-zinc-200 font-mono text-xs overflow-hidden" style={`filter: ${filterCss};`}>
            <div class="h-10 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0">
              <span class="text-zinc-500 uppercase tracking-widest text-[9px] font-bold">Text Reader</span>
              <button onclick={copyText}
                      class="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-medium transition-colors text-zinc-300 active:scale-95">
                {copyStatus}
              </button>
            </div>
            <pre class="flex-1 p-6 overflow-auto leading-relaxed select-text tab-size-4"><code class="block font-mono whitespace-pre">{textContent}</code></pre>
          </div>

        {:else if isPreviewableDoc}
          {#if !docResolved}
            <div class="absolute inset-0 flex items-center justify-center flex-col gap-3">
              <div class="w-8 h-8 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-[var(--pb-brand)] animate-spin"></div>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">Preparing fit-to-width preview…</p>
            </div>
          {:else}
            <!-- Fit-to-width document viewer with reading filter applied -->
            <div class="absolute inset-0 transition-[filter] duration-300" style={`filter: ${filterCss}; background: #ffffff;`}>
              <iframe title={displayName}
                      src={docIframeSrc}
                      class="w-full h-full border-none"
                      style="color-scheme: light;">
              </iframe>
            </div>
          {/if}

        {:else}
          <div class="absolute inset-0 flex items-center justify-center p-6">
            <div class="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-8 text-center flex flex-col items-center gap-4">
              <span class="text-5xl">{icon}</span>
              <div>
                <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-50 truncate w-full">{displayName}</h2>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">This file type ({contentType}) cannot be previewed natively.</p>
              </div>
              <div class="w-full border-t border-zinc-100 dark:border-zinc-800/80 my-2"></div>
              <div class="flex flex-col gap-2 w-full">
                <button type="button" onclick={handleDownload} disabled={downloading}
                        class="w-full py-2 text-xs font-semibold rounded-md shadow-sm text-center transition-all disabled:opacity-60"
                        style="background: var(--pb-brand); color: var(--pb-brand-fg);">
                  {downloading ? 'Downloading…' : `Download ${sizeStr}`}
                </button>
                {#if downloadError}<div class="text-[11px] text-red-600 text-center">{downloadError}</div>{/if}
              </div>
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <!-- ============ Collapsible metadata sidebar ============ -->
    {#if file}
      <aside class={`flex-shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto transition-all duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] ${showSidebar ? 'w-72' : 'w-0'}`}>
        <div class="w-72 p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500">Document details</h2>
            <button onclick={() => showSidebar = false} class="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" aria-label="Close details">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- File stats cards -->
          <div class="grid grid-cols-2 gap-2 mb-4">
            <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5">
              <div class="text-[9px] uppercase tracking-wider text-zinc-400 mb-0.5">Size</div>
              <div class="text-xs font-semibold">{sizeStr}</div>
            </div>
            <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5">
              <div class="text-[9px] uppercase tracking-wider text-zinc-400 mb-0.5">Type</div>
              <div class="text-xs font-semibold truncate" title={contentType}>{contentType}</div>
            </div>
            {#if createdDateStr}
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5">
                <div class="text-[9px] uppercase tracking-wider text-zinc-400 mb-0.5">Created</div>
                <div class="text-[11px] font-medium">{new Date(file.created_at ?? '').toLocaleDateString()}</div>
              </div>
            {/if}
            {#if updateDateStr}
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5">
                <div class="text-[9px] uppercase tracking-wider text-zinc-400 mb-0.5">Modified</div>
                <div class="text-[11px] font-medium">{new Date(file.updated_at ?? '').toLocaleDateString()}</div>
              </div>
            {/if}
          </div>

          <!-- Course location -->
          <div class="mb-4">
            <div class="text-[9px] uppercase tracking-wider text-zinc-400 mb-1">Course location</div>
            <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5 text-[11px] text-zinc-700 dark:text-zinc-300">
              {#if folder}
                <span class="opacity-60">📁</span> {folderPath}
              {:else}
                <span class="text-zinc-400">Loading folder…</span>
              {/if}
            </div>
          </div>

          <!-- Files in this folder — click to open without leaving the deck -->
          <div class="mb-4">
            <div class="flex items-center justify-between mb-1">
              <div class="text-[9px] uppercase tracking-wider text-zinc-400">In this folder</div>
              {#if siblingFiles.length > 0}
                <span class="text-[9px] text-zinc-400">{siblingFiles.length}</span>
              {/if}
            </div>
            {#if siblingFiles.length === 0}
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-2.5 text-[11px] text-zinc-400">
                {folder ? 'No other files.' : 'Loading…'}
              </div>
            {:else}
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden max-h-72 overflow-y-auto">
                {#each siblingFiles as sf (sf.id)}
                  {@const isCurrent = sf.id === activeFileId}
                  <button onclick={() => switchFile(sf.id)}
                          class={`w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors ${isCurrent
                            ? ''
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                          style={isCurrent ? 'background: var(--pb-brand-soft);' : ''}
                          title={sf.display_name}>
                    <span class="text-sm flex-shrink-0">{fileIcon(sf.display_name)}</span>
                    <div class="min-w-0 flex-1">
                      <div class={`text-[11px] truncate ${isCurrent ? 'font-semibold' : 'font-medium'}`}
                           style={isCurrent ? 'color: var(--pb-brand-strong);' : ''}>
                        {sf.display_name}
                      </div>
                      <div class="text-[10px] text-zinc-400">{fmtSize(sf.size)}</div>
                    </div>
                    {#if isCurrent}
                      <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background: var(--pb-brand);"></span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Technical IDs (click to copy) -->
          <div>
            <div class="text-[9px] uppercase tracking-wider text-zinc-400 mb-1">Technical IDs</div>
            <div class="space-y-1">
              {#each [['Course', courseId], ['File', activeFileId], ['Folder', file.folder_id ?? '—']] as const as [label, value]}
                <button onclick={() => copyId(label, value)}
                        class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-[var(--pb-brand)] transition-colors text-left">
                  <span class="text-[10px] uppercase tracking-wider text-zinc-400">{label}</span>
                  <span class="text-[11px] font-mono font-medium">{copiedId === label ? '✓ copied' : value}</span>
                </button>
              {/each}
            </div>
          </div>
        </div>
      </aside>
    {/if}
  </div>

  <!-- ============ Focus-mode floating controls ============ -->
  {#if focusMode}
    <div class="fixed bottom-5 right-5 z-30 flex items-center gap-2 animate-fade-in">
      <!-- Info toggle — keeps the file list / details reachable while the
           header (and its Info button) is hidden in focus mode. -->
      <button onclick={() => showSidebar = !showSidebar}
              class="w-10 h-10 flex items-center justify-center rounded-full shadow-2xl active:scale-95 transition-all"
              style={showSidebar
                ? 'background: var(--pb-brand); color: var(--pb-brand-fg); box-shadow: 0 8px 28px color-mix(in srgb, var(--pb-brand) 45%, transparent);'
                : 'background: rgba(255,255,255,0.95); color: rgb(63 63 70); box-shadow: 0 8px 24px rgba(0,0,0,0.18); border: 1px solid rgba(0,0,0,0.06);'}
              title={showSidebar ? 'Hide details' : 'Show file list & details'}>
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <!-- Exit focus -->
      <button onclick={() => focusMode = false}
              class="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-2xl text-xs font-semibold active:scale-95 transition-all"
              style="background: var(--pb-brand); color: var(--pb-brand-fg); box-shadow: 0 8px 28px color-mix(in srgb, var(--pb-brand) 45%, transparent);"
              title="Exit focus mode (Esc)">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4m0 5H4m5 0L4 4m11 5h5m-5 0V4m0 5l5-5M9 15v5m0-5H4m5 0l-5 5m11-5h5m-5 0v5m0-5l5 5" />
        </svg>
        Exit Focus
      </button>
    </div>
  {/if}
</div>

<style>
  .animate-spin { animation: spin 0.8s linear infinite; }
  .animate-fade-in { animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
  .tab-size-4 { tab-size: 4; }
</style>
