<script lang="ts">
  import { onMount } from 'svelte';
  import Entry from './Entry.svelte';
  import Composer from './Composer.svelte';
  import {
    discussionState, loadDiscussion, openReply, closeReply, submitTopLevel,
    countAll, filterTree
  } from './store.svelte';

  let { courseId, topicId }: { courseId: number; topicId: number } = $props();

  onMount(() => {
    loadDiscussion(courseId, topicId);
  });

  const total = $derived(countAll(discussionState.entries));
  const unreadCount = $derived(discussionState.unread.size);
  const filtered = $derived(filterTree(discussionState.entries, discussionState.search, discussionState.participants));
  const topLevelComposerOpen = $derived(discussionState.replyOpenFor === 0);
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-5xl mx-auto px-6 py-8">
    {#if discussionState.loading && !discussionState.topic}
      <div class="flex items-center justify-center py-20 text-sm text-zinc-400">
        <svg class="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9" />
        </svg>
        Loading discussion…
      </div>
    {:else if discussionState.error}
      <div class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">
        {discussionState.error}
      </div>
    {:else if discussionState.topic}
      <!-- Topic header -->
      <header class="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800/50">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
          <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
          Discussion
          <span class="text-zinc-300 dark:text-zinc-700">·</span>
          <span>{total} {total === 1 ? 'reply' : 'replies'}</span>
          {#if unreadCount > 0}
            <span class="text-zinc-300 dark:text-zinc-700">·</span>
            <span style="color: var(--pb-brand);">{unreadCount} unread</span>
          {/if}
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">{discussionState.topic.title}</h1>
        <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          {#if discussionState.topic.author?.display_name}
            <span class="font-medium text-zinc-700 dark:text-zinc-300">{discussionState.topic.author.display_name}</span>
            <span>·</span>
          {/if}
          {#if discussionState.topic.posted_at}
            <span>{new Date(discussionState.topic.posted_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          {/if}
        </div>
        {#if discussionState.topic.message}
          <div class="mt-5 prose prose-sm dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 [&_a]:underline">{@html discussionState.topic.message}</div>
        {/if}
      </header>

      <!-- Toolbar -->
      <div class="flex items-center gap-2 mb-4">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
          <input
            bind:value={discussionState.search}
            type="text"
            placeholder="Search replies and authors…"
            class="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent placeholder:text-zinc-400" />
        </div>
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-md active:scale-95 transition-transform"
          style="background: var(--pb-brand); color: var(--pb-brand-fg);"
          onclick={() => topLevelComposerOpen ? closeReply() : openReply(0)}>
          {topLevelComposerOpen ? 'Cancel' : 'Reply'}
        </button>
      </div>

      <!-- Top-level composer -->
      {#if topLevelComposerOpen}
        <div class="mb-6">
          <Composer
            placeholder="Add your reply to the discussion…"
            submitting={discussionState.posting}
            onSubmit={submitTopLevel}
            onCancel={closeReply} />
        </div>
      {/if}

      <!-- Entries -->
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800/50">
        {#if filtered.length === 0}
          <div class="py-12 text-center text-sm text-zinc-400">
            {discussionState.search ? `No matches for "${discussionState.search}".` : 'No replies yet. Be the first.'}
          </div>
        {:else}
          {#each filtered as entry (entry.id)}
            <Entry {entry} />
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>
