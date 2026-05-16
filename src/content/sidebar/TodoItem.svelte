<script lang="ts">
  import type { PlannerItem } from '../../lib/types';
  import { markItemComplete } from './stores.svelte';

  let { item, color = '#cbd5e1' }: { item: PlannerItem; color?: string } = $props();

  const typeIcon: Record<string, string> = {
    assignment: '📝',
    quiz: '✓',
    discussion_topic: '💬',
    planner_note: '📌',
    announcement: '📣',
    wiki_page: '📄',
    calendar_event: '📅'
  };

  function relativeDue(iso: string): string {
    const due = new Date(iso);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const absHours = Math.abs(diffMs) / 3_600_000;
    if (absHours < 24 && diffMs > 0) {
      const h = Math.round(absHours);
      return h <= 1 ? 'in <1h' : `in ${h}h`;
    }
    return due.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  }

  const title = $derived(item.plannable.title ?? item.plannable.name ?? 'Untitled');
  const points = $derived(item.plannable.points_possible);
  let hovered = $state(false);
  let busy = $state(false);

  async function onMarkDone(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    busy = true;
    await markItemComplete(item);
    busy = false;
  }
</script>

<a href={item.html_url}
   target="_blank"
   rel="noopener"
   onmouseenter={() => (hovered = true)}
   onmouseleave={() => (hovered = false)}
   class="group relative flex items-start gap-2.5 pl-3 pr-2 py-2.5 border-l-[3px] hover:bg-gradient-to-r hover:from-zinc-50 hover:to-transparent dark:hover:from-zinc-800/50 dark:hover:to-transparent hover:translate-x-0.5 transition-all duration-150"
   style="border-color: {color}">
  <span class="w-6 h-6 flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-sm flex-shrink-0 mt-0.5" aria-hidden="true">
    {typeIcon[item.plannable_type] ?? '•'}
  </span>
  <div class="min-w-0 flex-1">
    <div class="text-sm font-medium leading-snug truncate text-zinc-900 dark:text-zinc-100">{title}</div>
    <div class="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
      <span class="truncate">{item.context_name ?? ''}</span>
      <span>·</span>
      <span class="whitespace-nowrap">{relativeDue(item.plannable_date)}</span>
      {#if points != null}
        <span>·</span>
        <span>{points} pts</span>
      {/if}
    </div>
  </div>
  {#if hovered}
    <button
      onclick={onMarkDone}
      disabled={busy}
      class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all duration-150"
      title="Mark as done">
      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </button>
  {/if}
</a>
