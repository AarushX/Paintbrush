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
   class="group relative block pl-3 pr-2 py-2 border-l-[3px] hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
   style="border-color: {color}">
  <div class="flex items-start gap-2">
    <span class="text-base leading-none mt-0.5" aria-hidden="true">{typeIcon[item.plannable_type] ?? '•'}</span>
    <div class="min-w-0 flex-1">
      <div class="text-sm font-medium leading-snug truncate">{title}</div>
      <div class="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
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
        class="absolute right-2 top-2 px-1.5 py-0.5 text-[11px] rounded bg-indigo-600 text-white opacity-90 hover:opacity-100 disabled:opacity-50"
        title="Mark as done">
        ✓
      </button>
    {/if}
  </div>
</a>
