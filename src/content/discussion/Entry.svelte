<script lang="ts">
  import type { DiscussionEntryFull } from '../../lib/types';
  import {
    discussionState, toggleCollapsed, openReply, closeReply, submitReply, markRead
  } from './store.svelte';
  import Composer from './Composer.svelte';
  import Entry from './Entry.svelte';

  let { entry, depth = 0 }: { entry: DiscussionEntryFull; depth?: number } = $props();

  const participant = $derived(discussionState.participants.get(entry.user_id));
  const isUnread = $derived(discussionState.unread.has(entry.id));
  const isCollapsed = $derived(discussionState.collapsedIds.has(entry.id));
  const replyOpen = $derived(discussionState.replyOpenFor === entry.id);
  const replyCount = $derived(entry.replies?.length ?? 0);

  function initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
  }

  function relativeTime(iso: string): string {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const m = Math.floor(diffMs / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: days > 365 ? 'numeric' : undefined });
  }

  let observerEl: HTMLElement | undefined = $state();
  $effect(() => {
    if (!observerEl || !isUnread) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        markRead(entry.id);
        io.disconnect();
      }
    }, { threshold: 0.6 });
    io.observe(observerEl);
    return () => io.disconnect();
  });
</script>

<div bind:this={observerEl} class={`group relative ${depth > 0 ? 'pl-5 ml-2 border-l-2 border-zinc-100 dark:border-zinc-800/50' : ''} ${isUnread ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}`}>
  <div class="flex gap-3 py-3 pr-2">
    <!-- Avatar -->
    <div class="flex-shrink-0">
      {#if participant?.avatar_image_url}
        <img src={participant.avatar_image_url} alt="" class="w-9 h-9 rounded-full object-cover bg-zinc-100 dark:bg-zinc-800" loading="lazy" />
      {:else}
        <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold" style="background: color-mix(in srgb, var(--pb-brand) 14%, transparent); color: var(--pb-brand-strong);">
          {initials(participant?.display_name ?? '?')}
        </div>
      {/if}
    </div>
    <!-- Body -->
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-2 mb-0.5">
        <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{participant?.display_name ?? `User ${entry.user_id}`}</span>
        <span class="text-[11px] text-zinc-400 dark:text-zinc-500" title={new Date(entry.created_at).toLocaleString()}>{relativeTime(entry.created_at)}</span>
        {#if isUnread}
          <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
        {/if}
      </div>
      {#if !entry.deleted}
        <div class="prose prose-sm dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 leading-snug [&_a]:underline [&_a]:text-inherit [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">{@html entry.message}</div>
      {:else}
        <div class="italic text-xs text-zinc-400">[deleted]</div>
      {/if}
      <div class="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-400">
        <button class="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" onclick={() => openReply(entry.id)}>
          Reply
        </button>
        {#if replyCount > 0}
          <button class="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors flex items-center gap-1" onclick={() => toggleCollapsed(entry.id)}>
            <svg class={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </button>
        {/if}
      </div>
      {#if replyOpen}
        <div class="mt-3">
          <Composer
            placeholder="Reply to {participant?.display_name ?? 'this post'}…"
            submitting={discussionState.posting}
            onSubmit={(html) => submitReply(entry.id, html)}
            onCancel={closeReply} />
        </div>
      {/if}
    </div>
  </div>
  {#if !isCollapsed && entry.replies && entry.replies.length > 0}
    {#each entry.replies as child (child.id)}
      <Entry entry={child} depth={depth + 1} />
    {/each}
  {/if}
</div>
