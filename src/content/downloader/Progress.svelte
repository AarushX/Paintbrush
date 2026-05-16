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

<div class="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 font-sans">
  <div class="w-[420px] rounded-lg bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 p-5 text-zinc-900 dark:text-zinc-100">
    {#if phase === 'running'}
      <h3 class="text-sm font-semibold">{title}</h3>
      <div class="mt-3 text-xs text-zinc-500 truncate" title={currentFile}>{currentFile || ' '}</div>
      <div class="mt-2 flex items-center gap-3">
        <div class="flex-1 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div class="h-full bg-indigo-600 transition-all" style="width: {percent}%"></div>
        </div>
        <span class="text-xs tabular-nums text-zinc-500">{completed} / {total}</span>
      </div>
      <div class="mt-4 flex justify-end">
        <button onclick={onCancel}
                class="px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          Cancel
        </button>
      </div>
    {:else if phase === 'done'}
      <h3 class="text-sm font-semibold">Done</h3>
      <p class="mt-2 text-xs text-zinc-500">{successMessage}</p>
    {:else if phase === 'error'}
      <h3 class="text-sm font-semibold text-red-600">Download failed</h3>
      <p class="mt-2 text-xs text-zinc-500 whitespace-pre-wrap">{error}</p>
      <div class="mt-4 flex justify-end">
        <button onclick={onCancel}
                class="px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          Close
        </button>
      </div>
    {:else}
      <h3 class="text-sm font-semibold">Cancelled</h3>
    {/if}
  </div>
</div>
