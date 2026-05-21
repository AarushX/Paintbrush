<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchFileDetail } from './api';
  import { downloadFileFromUrl } from '../downloader/zip';
  import type { FileFull } from '../../lib/types';

  let downloading = $state(false);
  let downloadError = $state('');

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

  let { courseId, fileId, onShowCanvas }: { courseId: number; fileId: number; onShowCanvas?: () => void } = $props();

  let file = $state<FileFull | null>(null);
  let loading = $state(true);
  let error = $state('');
  let textContent = $state('');
  let isText = $state(false);
  let copyStatus = $state('Copy');

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

  // Safe reactive derived properties to guard against null dereferencing in template
  const fileType = $derived(file ? getFileType(file.display_name) : 'other');
  const icon = $derived(file ? fileIcon(file.display_name) : '📄');
  const sizeStr = $derived(file ? fmtSize(file.size) : '');
  const displayName = $derived(file ? file.display_name : 'Loading File...');
  const fileUrl = $derived(file ? file.url : '');
  const previewUrl = $derived(file ? file.preview_url : null);
  const contentType = $derived(file ? file.content_type : 'Unknown');
  const updateDateStr = $derived(file && file.updated_at ? new Date(file.updated_at).toLocaleDateString() : '');

  const isPreviewableDoc = $derived.by(() => {
    if (!file) return false;
    if (file.preview_url) return true;
    const ext = file.display_name.toLowerCase().split('.').pop() ?? '';
    return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'ods', 'odp'].includes(ext);
  });

  const docPreviewUrl = $derived(
    `/courses/${courseId}/files/${fileId}/preview?doc_preview=1`
  );

  async function load() {
    loading = true; error = '';
    try {
      file = await fetchFileDetail(fileId);
      if (file) {
        const type = getFileType(file.display_name);
        if (type === 'text') {
          isText = true;
          const res = await fetch(file.url);
          if (res.ok) {
            textContent = await res.text();
          } else {
            isText = false;
          }
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = `/courses/${courseId}/files`;
    }
  }

  function copyText() {
    navigator.clipboard.writeText(textContent);
    copyStatus = 'Copied!';
    setTimeout(() => {
      copyStatus = 'Copy';
    }, 2000);
  }
</script>

<div class="h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans flex flex-col overflow-hidden">
  <!-- Header -->
  <header class="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur flex items-center justify-between px-6 z-10 flex-shrink-0">
    <div class="flex items-center gap-3 min-w-0">
      <button onclick={goBack} 
              class="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              aria-label="Back to Files">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-lg flex-shrink-0">{icon}</span>
          <h1 class="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-50">{displayName}</h1>
        </div>
        {#if file}
          <div class="text-[11px] text-zinc-500 dark:text-zinc-400">
            {sizeStr}
            {#if updateDateStr}
              · Updated {updateDateStr}
            {/if}
          </div>
        {:else}
          <div class="text-[11px] text-zinc-400">Loading File Details...</div>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-2">
      {#if file}
        <button type="button"
           onclick={handleDownload}
           disabled={downloading}
           class="px-3 py-1.5 text-xs font-medium rounded-md active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60"
           style="background: var(--pb-brand); color: var(--pb-brand-fg);"
           title={downloadError || 'Download file'}>
          <svg class={`w-3.5 h-3.5 ${downloading ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          {downloading ? 'Downloading…' : 'Download'}
        </button>

        <a href={fileUrl} target="_blank" rel="noopener noreferrer"
           class="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open in New Tab
        </a>
      {/if}

      {#if onShowCanvas}
        <button onclick={onShowCanvas}
                class="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors flex items-center gap-1">
          Canvas View
        </button>
      {/if}
    </div>
  </header>

  <!-- Viewport -->
  <div class="flex-1 w-full relative overflow-hidden bg-zinc-100 dark:bg-zinc-900">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center flex-col gap-3">
        <div class="w-8 h-8 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-[var(--pb-brand)] animate-spin"></div>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">Loading document viewer...</p>
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
        <!-- Premium Centered Image View -->
        <div class="absolute inset-0 flex items-center justify-center p-6 bg-zinc-950/95 dark:bg-black/95">
          <img src={fileUrl} alt={displayName} 
               class="max-h-full max-w-full rounded-md shadow-2xl object-contain border border-zinc-800/40 select-none animate-fade-in" />
        </div>

      {:else if fileType === 'video'}
        <!-- Premium Centered Video View -->
        <div class="absolute inset-0 flex items-center justify-center p-6 bg-zinc-950/95 dark:bg-black/95">
          <video src={fileUrl} controls autoplay
                 class="max-h-full max-w-full rounded-lg shadow-2xl border border-zinc-800/40">
            <track kind="captions" />
          </video>
        </div>

      {:else if fileType === 'audio'}
        <!-- Premium Audio Player Card -->
        <div class="absolute inset-0 flex items-center justify-center p-6 bg-zinc-950/20 dark:bg-black/40">
          <div class="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-6 flex flex-col items-center gap-6">
            <div class="w-24 h-24 rounded-full bg-[var(--pb-brand-soft)] text-4xl flex items-center justify-center shadow-inner animate-pulse">
              🎵
            </div>
            <div class="text-center w-full">
              <h2 class="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100">{displayName}</h2>
              <p class="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">{sizeStr} · Audio File</p>
            </div>
            <audio src={fileUrl} controls autoplay class="w-full mt-2"></audio>
          </div>
        </div>

      {:else if fileType === 'text'}
        <!-- Styled Monospace Code/Text view -->
        <div class="absolute inset-0 flex flex-col bg-zinc-900 text-zinc-200 font-mono text-xs overflow-hidden">
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
        <!-- High-Fidelity Canvas Document/PDF Viewer -->
        <iframe title={displayName}
                src={docPreviewUrl}
                class="w-full h-full border-none absolute inset-0 bg-white dark:bg-zinc-900"
                style="color-scheme: light;">
        </iframe>

      {:else}
        <!-- Descriptive Unsupported File Card -->
        <div class="absolute inset-0 flex items-center justify-center p-6">
          <div class="w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-8 text-center flex flex-col items-center gap-4">
            <span class="text-5xl">{icon}</span>
            <div>
              <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-50 truncate w-full">{displayName}</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">This file type ({contentType}) cannot be previewed natively.</p>
            </div>
            <div class="w-full border-t border-zinc-100 dark:border-zinc-800/80 my-2"></div>
            <div class="flex flex-col gap-2 w-full">
              <button type="button"
                 onclick={handleDownload}
                 disabled={downloading}
                 class="w-full py-2 text-xs font-semibold rounded-md shadow-sm text-center transition-all disabled:opacity-60"
                 style="background: var(--pb-brand); color: var(--pb-brand-fg);">
                {downloading ? 'Downloading…' : `Download ${sizeStr}`}
              </button>
              {#if downloadError}
                <div class="text-[11px] text-red-600 text-center">{downloadError}</div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .animate-spin {
    animation: spin 0.8s linear infinite;
  }
  .animate-fade-in {
    animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }
  .tab-size-4 {
    tab-size: 4;
  }
</style>
