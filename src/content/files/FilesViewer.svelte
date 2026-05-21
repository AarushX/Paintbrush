<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchCourseFolders, fetchFolderFiles, fetchFolderSubfolders, fetchRootFolder } from './api';
  import { downloadAllFiles } from '../downloader/files';
  import { downloadFileFromUrl } from '../downloader/zip';
  import FilePreview from './FilePreview.svelte';
  import type { FolderFull, FileFull } from '../../lib/types';

  let { courseId, initialFolderPath }: { courseId: number; initialFolderPath: string } = $props();

  let downloadingId = $state<number | null>(null);
  // When set, the FilePreview deck opens inline over the file list.
  let previewFileId = $state<number | null>(null);

  let folders = $state<FolderFull[]>([]);
  let rootFolderId = $state<number | null>(null);
  let currentFolderId = $state<number | null>(null);
  let files = $state<FileFull[]>([]);
  let subfolders = $state<FolderFull[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let sortBy = $state<'name' | 'newest' | 'largest'>('name');
  let showHidden = $state(false);
  let viewMode = $state<'grid' | 'list'>('grid');

  async function handleFileDownload(f: FileFull) {
    if (downloadingId === f.id) return;
    downloadingId = f.id;
    try {
      await downloadFileFromUrl(f.url, f.display_name);
    } catch (err) {
      console.error('[Paintbrush] file download failed', err);
    } finally {
      downloadingId = null;
    }
  }

  // Ask the Paintbrush sidebar to open its Files panel. The sidebar listens
  // for this event and switches itself to the Files view for this course.
  function openFilesPanel() {
    document.dispatchEvent(new CustomEvent('paintbrush:open-files'));
  }

  async function loadFolderList() {
    try {
      const [root, list] = await Promise.all([
        fetchRootFolder(courseId),
        fetchCourseFolders(courseId)
      ]);
      folders = list;
      rootFolderId = root.id;
      if (currentFolderId == null) currentFolderId = resolveFolderId(initialFolderPath) ?? root.id;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  function resolveFolderId(path: string): number | null {
    if (!path) return rootFolderId;
    const target = ('course files/' + path).replace(/\/+$/, '');
    const f = folders.find(x => x.full_name === target);
    return f?.id ?? rootFolderId;
  }

  async function loadFolderContents(fid: number) {
    loading = true; error = '';
    try {
      const [fl, sub] = await Promise.all([
        fetchFolderFiles(fid).catch(() => [] as FileFull[]),
        fetchFolderSubfolders(fid).catch(() => [] as FolderFull[])
      ]);
      files = fl;
      subfolders = sub;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    await loadFolderList();
    if (currentFolderId != null) await loadFolderContents(currentFolderId);
  });

  // Re-fetch contents when folder changes
  let lastFid: number | null = null;
  $effect(() => {
    if (currentFolderId != null && currentFolderId !== lastFid) {
      lastFid = currentFolderId;
      loadFolderContents(currentFolderId);
    }
  });

  const currentFolder = $derived(folders.find(f => f.id === currentFolderId));
  const breadcrumb = $derived.by(() => {
    if (!currentFolder) return [] as FolderFull[];
    const chain: FolderFull[] = [currentFolder];
    let cur: FolderFull | undefined = currentFolder;
    while (cur && cur.parent_folder_id != null) {
      const parent = folders.find(f => f.id === cur!.parent_folder_id);
      if (!parent) break;
      chain.unshift(parent);
      cur = parent;
    }
    return chain;
  });

  function navTo(f: FolderFull) {
    currentFolderId = f.id;
    const path = f.full_name.replace(/^course files\/?/, '');
    const url = path ? `/courses/${courseId}/files/folder/${encodeURIComponent(path)}` : `/courses/${courseId}/files`;
    history.pushState({ pbFolder: f.id }, '', url);
  }

  onMount(() => {
    function onPop() {
      // re-resolve from URL
      const m = location.pathname.match(/\/courses\/\d+\/files(?:\/folder\/(.*))?\/?$/);
      const path = m && m[1] ? decodeURIComponent(m[1]) : '';
      const fid = resolveFolderId(path);
      if (fid != null) currentFolderId = fid;
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function fmtDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days < 1) return 'Today';
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: days > 365 ? 'numeric' : undefined });
  }

  function fileExt(name: string): string {
    return name.toLowerCase().split('.').pop() ?? '';
  }

  function fileIcon(f: FileFull): string {
    const ext = fileExt(f.display_name);
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

  // Per-type accent color for the grid icon tiles.
  function fileAccent(name: string): string {
    const ext = fileExt(name);
    if (['jpg','jpeg','png','gif','webp','svg','heic'].includes(ext)) return '#10b981';
    if (['mp4','mov','avi','webm','mkv'].includes(ext)) return '#f43f5e';
    if (['mp3','wav','aac','flac','m4a'].includes(ext)) return '#8b5cf6';
    if (['zip','tar','gz','rar','7z'].includes(ext)) return '#f59e0b';
    if (['pdf'].includes(ext)) return '#ef4444';
    if (['doc','docx','rtf'].includes(ext)) return '#3b82f6';
    if (['xls','xlsx','csv'].includes(ext)) return '#22c55e';
    if (['ppt','pptx'].includes(ext)) return '#f97316';
    return '#71717a';
  }

  const filteredFolders = $derived.by(() => {
    let list = subfolders;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(f => f.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      if (sortBy === 'newest') return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
      return a.name.localeCompare(b.name);
    });
  });

  const filteredFiles = $derived.by(() => {
    let list = files;
    if (!showHidden) list = list.filter(f => !f.hidden);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(f => f.display_name.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      if (sortBy === 'newest') return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
      if (sortBy === 'largest') return b.size - a.size;
      return a.display_name.localeCompare(b.display_name);
    });
  });
</script>

<div class={`relative w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans ${previewFileId != null ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
  <div class="max-w-5xl mx-auto px-6 py-6">

    <!-- Header -->
    <header class="mb-4 flex items-center justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-1">
          <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
          Files
          <span class="text-zinc-300 dark:text-zinc-700">·</span>
          <span>{filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}</span>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight">Files</h1>
      </div>
      <button onclick={() => downloadAllFiles(courseId)}
              class="px-3 py-1.5 text-xs font-medium rounded-md active:scale-95 transition-transform flex items-center gap-1.5"
              style="background: var(--pb-brand); color: var(--pb-brand-fg);">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
        Download all (.zip)
      </button>
    </header>

    <!-- Files panel promo: nudge toward the always-on sidebar file browser -->
    <button onclick={openFilesPanel}
            class="group w-full mb-5 flex items-center gap-3.5 rounded-xl border p-3.5 text-left transition-all hover:shadow-md active:scale-[0.995]"
            style="border-color: color-mix(in srgb, var(--pb-brand) 32%, transparent); background: var(--pb-brand-soft);">
      <span class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
            style="background: var(--pb-brand); color: var(--pb-brand-fg);">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 4v16M4 7a3 3 0 013-3h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7z" />
        </svg>
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold" style="color: var(--pb-brand-strong);">Browse files in the side panel</div>
        <div class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
          Open any file in the viewer and jump between files without leaving the page you're on.
        </div>
      </div>
      <span class="flex-shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-md flex items-center gap-1 transition-transform group-hover:translate-x-0.5"
            style="background: var(--pb-brand); color: var(--pb-brand-fg);">
        Open panel
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
      </span>
    </button>

    <!-- Breadcrumb -->
    {#if breadcrumb.length > 0}
      <nav class="flex items-center gap-1 mb-4 text-xs text-zinc-500 flex-wrap">
        {#each breadcrumb as f, i}
          {#if i > 0}<span class="text-zinc-300 dark:text-zinc-700">/</span>{/if}
          {#if i === breadcrumb.length - 1}
            <span class="font-medium text-zinc-900 dark:text-zinc-100">{i === 0 ? 'Files' : f.name}</span>
          {:else}
            <button onclick={() => navTo(f)} class="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              {i === 0 ? 'Files' : f.name}
            </button>
          {/if}
        {/each}
      </nav>
    {/if}

    <!-- Toolbar -->
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <div class="relative flex-1 min-w-[180px]">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
        <input bind:value={search} placeholder="Search this folder…"
               class="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent placeholder:text-zinc-400" />
      </div>
      <select bind:value={sortBy} class="px-2.5 py-1.5 text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <option value="name">Sort: Name</option>
        <option value="newest">Sort: Newest</option>
        <option value="largest">Sort: Largest</option>
      </select>
      <label class="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer">
        <input type="checkbox" bind:checked={showHidden} /> Show hidden
      </label>
      <!-- View toggle -->
      <div class="flex items-center rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <button onclick={() => viewMode = 'grid'} title="Grid view"
                class={`p-1.5 transition-colors ${viewMode === 'grid' ? 'text-[var(--pb-brand-fg)]' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                style={viewMode === 'grid' ? 'background: var(--pb-brand);' : ''}>
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>
        </button>
        <button onclick={() => viewMode = 'list'} title="List view"
                class={`p-1.5 transition-colors ${viewMode === 'list' ? 'text-[var(--pb-brand-fg)]' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                style={viewMode === 'list' ? 'background: var(--pb-brand);' : ''}>
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>
    </div>

    {#if loading && files.length === 0 && subfolders.length === 0}
      <div class="py-16 text-center text-sm text-zinc-400">Loading…</div>
    {:else if error}
      <div class="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else if filteredFolders.length === 0 && filteredFiles.length === 0}
      <div class="py-16 text-center text-sm text-zinc-400">{search ? `No matches for "${search}".` : 'This folder is empty.'}</div>
    {:else if viewMode === 'grid'}
      <!-- Grid -->
      {#if filteredFolders.length > 0}
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
          {#each filteredFolders as f (f.id)}
            <button onclick={() => navTo(f)}
                    class={`group flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-left transition-all hover:border-[var(--pb-brand)] hover:shadow-md ${f.locked_for_user ? 'opacity-50' : ''}`}>
              <span class="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">📁</span>
              <div class="mt-2.5 text-[13px] font-medium leading-snug line-clamp-2">{f.name}</div>
              <div class="mt-auto pt-1.5 text-[10px] text-zinc-400">
                {(f.files_count ?? 0)} files · {(f.folders_count ?? 0)} folders
              </div>
            </button>
          {/each}
        </div>
      {/if}
      {#if filteredFiles.length > 0}
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {#each filteredFiles as f (f.id)}
            {@const accent = fileAccent(f.display_name)}
            <div class={`group relative flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 transition-all hover:border-[var(--pb-brand)] hover:shadow-md ${f.locked_for_user ? 'opacity-50' : ''}`}>
              <button type="button" onclick={() => previewFileId = f.id}
                      class="absolute inset-0 rounded-xl" aria-label={`Preview ${f.display_name}`}></button>
              <span class="w-10 h-10 rounded-lg flex items-center justify-center text-lg pointer-events-none"
                    style={`background: color-mix(in srgb, ${accent} 14%, transparent); color: ${accent};`}>
                {fileIcon(f)}
              </span>
              <div class="mt-2.5 text-[13px] font-medium leading-snug line-clamp-2 pointer-events-none">{f.display_name}</div>
              <div class="mt-auto pt-1.5 text-[10px] text-zinc-400 pointer-events-none">
                {fmtSize(f.size)}{f.updated_at ? ` · ${fmtDate(f.updated_at)}` : ''}
              </div>
              <button type="button"
                      onclick={(e) => { e.stopPropagation(); handleFileDownload(f); }}
                      disabled={downloadingId === f.id}
                      class="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-white/95 dark:bg-zinc-800/95 text-zinc-400 hover:text-[var(--pb-brand-strong)] shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-60"
                      title="Download">
                <svg class={`w-3.5 h-3.5 ${downloadingId === f.id ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <!-- List -->
      <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
        {#each filteredFolders as f (f.id)}
          <button onclick={() => navTo(f)} class={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left ${f.locked_for_user ? 'opacity-50' : ''}`}>
            <span class="text-base flex-shrink-0">📁</span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium truncate">{f.name}</div>
              <div class="text-[11px] text-zinc-500 truncate">
                {(f.files_count ?? 0)} files · {(f.folders_count ?? 0)} folders
                {#if f.updated_at}<span> · {fmtDate(f.updated_at)}</span>{/if}
              </div>
            </div>
            <svg class="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        {/each}
        {#each filteredFiles as f (f.id)}
          {@const accent = fileAccent(f.display_name)}
          <div class={`flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${f.locked_for_user ? 'opacity-50' : ''}`}>
            <span class="w-7 h-7 rounded-md flex items-center justify-center text-sm flex-shrink-0"
                  style={`background: color-mix(in srgb, ${accent} 14%, transparent); color: ${accent};`}>{fileIcon(f)}</span>
            <button type="button" onclick={() => previewFileId = f.id}
                    class="min-w-0 flex-1 group text-left" style="color: inherit;">
              <div class="text-sm font-medium truncate group-hover:underline" style="text-underline-offset: 3px;">{f.display_name}</div>
              <div class="text-[11px] text-zinc-500 truncate">{fmtSize(f.size)}{f.updated_at ? ` · ${fmtDate(f.updated_at)}` : ''}</div>
            </button>
            <button type="button" onclick={() => previewFileId = f.id}
                    class="px-2 py-1 text-[11px] font-medium rounded text-zinc-500 hover:text-[var(--pb-brand-strong)] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Open in viewer">
              View
            </button>
            <button type="button"
                    onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleFileDownload(f); }}
                    disabled={downloadingId === f.id}
                    class="p-1.5 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
                    title="Download">
              <svg class={`w-3.5 h-3.5 ${downloadingId === f.id ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Inline file preview deck — opens over the list, no navigation -->
  {#if previewFileId != null}
    {#key previewFileId}
      <FilePreview
        {courseId}
        fileId={previewFileId}
        embedded
        hostId="paintbrush-files-root"
        backLabel="Files"
        onClose={() => previewFileId = null} />
    {/key}
  {/if}
</div>
