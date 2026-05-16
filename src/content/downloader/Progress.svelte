<script lang="ts">
  type Phase = 'running' | 'done' | 'error' | 'cancelled';
  let {
    title = 'Downloading…',
    currentFile = '',
    completed = 0,
    total = 0,
    phase = 'running' as Phase,
    error = '',
    successMessage = '',
    onCancel = () => {}
  }: {
    title?: string;
    currentFile?: string;
    completed?: number;
    total?: number;
    phase?: Phase;
    error?: string;
    successMessage?: string;
    onCancel?: () => void;
  } = $props();

  let percent = $derived(total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0);
</script>

<div class="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 backdrop-blur-sm font-sans">
  <div class="w-[440px] rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/20 border border-zinc-200/50 dark:border-zinc-800/50 p-6 text-zinc-900 dark:text-zinc-100 relative overflow-hidden"
       style="animation: pb-modal-in 0.2s cubic-bezier(0.22,0.61,0.36,1) both;">
    <!-- Top accent gradient line -->
    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"></div>

    {#if phase === 'running'}
      <h3 class="text-sm font-semibold tracking-tight">{title}</h3>
      <div class="mt-3 text-xs text-zinc-400 dark:text-zinc-500 truncate font-mono" title={currentFile}>{currentFile || ' '}</div>
      <div class="mt-3 flex items-center gap-3">
        <div class="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-300 ease-out shadow-sm shadow-indigo-500/30" style="width: {percent}%"></div>
        </div>
        <span class="text-xs tabular-nums text-zinc-400 dark:text-zinc-500 font-medium">{completed} / {total}</span>
      </div>
      <div class="mt-5 flex justify-end">
        <button onclick={onCancel}
                class="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-150 active:scale-95">
          Cancel
        </button>
      </div>
    {:else if phase === 'done'}
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex-shrink-0">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div>
          <h3 class="text-sm font-semibold tracking-tight">Done</h3>
          <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{successMessage}</p>
        </div>
      </div>
    {:else if phase === 'error'}
      <div class="flex items-start gap-2.5">
        <span class="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-semibold tracking-tight text-red-600 dark:text-red-400">Download failed</h3>
          <p class="mt-1 text-xs text-zinc-400 dark:text-zinc-500 whitespace-pre-wrap break-words">{error}</p>
        </div>
      </div>
      <div class="mt-5 flex justify-end">
        <button onclick={onCancel}
                class="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-150 active:scale-95">
          Close
        </button>
      </div>
    {:else}
      <div class="flex items-center gap-2.5">
        <span class="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex-shrink-0">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </span>
        <h3 class="text-sm font-semibold tracking-tight text-zinc-500 dark:text-zinc-400">Cancelled</h3>
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes pb-modal-in {
    from { opacity: 0; transform: scale(0.96) translateY(4px); }
    to   { opacity: 1; transform: scale(1)    translateY(0);   }
  }
</style>
