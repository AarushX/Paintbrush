<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchCourseFolders, fetchFolderFiles, fetchFolderSubfolders, fetchRootFolder } from './api';
  import { downloadAllFiles } from '../downloader/files';
  import type { FolderFull, FileFull } from '../../lib/types';

  let { courseId, initialFolderPath }: { courseId: number; initialFolderPath: string } = $props();

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

  function fileIcon(f: FileFull): string {
    const ext = f.display_name.toLowerCase().split('.').pop() ?? '';
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

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-5xl mx-auto px-6 py-6">

    <!-- Header -->
    <header class="mb-4 flex items-center justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-1">
          <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
          Files
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
    </div>

    {#if loading && files.length === 0 && subfolders.length === 0}
      <div class="py-16 text-center text-sm text-zinc-400">Loading…</div>
    {:else if error}
      <div class="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else if filteredFolders.length === 0 && filteredFiles.length === 0}
      <div class="py-16 text-center text-sm text-zinc-400">{search ? `No matches for "${search}".` : 'This folder is empty.'}</div>
    {:else}
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
          <div class={`flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${f.locked_for_user ? 'opacity-50' : ''}`}>
            <span class="text-base flex-shrink-0">{fileIcon(f)}</span>
            <a href={`/courses/${courseId}/files/${f.id}`} class="min-w-0 flex-1 group" style="color: inherit; text-decoration: none;">
              <div class="text-sm font-medium truncate group-hover:underline" style="text-underline-offset: 3px;">{f.display_name}</div>
              <div class="text-[11px] text-zinc-500 truncate">{fmtSize(f.size)}{f.updated_at ? ` · ${fmtDate(f.updated_at)}` : ''}</div>
            </a>
            <a href={f.url} download={f.display_name} class="p-1.5 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="Download">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
            </a>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
