<script lang="ts">
  import { searchRecipients, fetchCourses, createConversation } from './api';
  import type { CourseLite, RecipientSearchResult } from '../../lib/types';

  let { open = $bindable(false), onSent }: { open?: boolean; onSent: () => void } = $props();

  let courses = $state<CourseLite[]>([]);
  let courseFilter = $state<string>('');  // context_code like "course_123"
  let recipients = $state<RecipientSearchResult[]>([]);
  let query = $state('');
  let searching = $state(false);
  let results = $state<RecipientSearchResult[]>([]);
  let subject = $state('');
  let body = $state('');
  let sending = $state(false);
  let error = $state('');

  $effect(() => {
    if (open && courses.length === 0) {
      fetchCourses().then(c => { courses = c; }).catch(() => {});
    }
  });

  let searchTimer: number | null = null;
  $effect(() => {
    if (searchTimer != null) window.clearTimeout(searchTimer);
    const q = query.trim();
    if (!q) { results = []; return; }
    searching = true;
    searchTimer = window.setTimeout(async () => {
      try { results = await searchRecipients(q, courseFilter || undefined); }
      catch { results = []; }
      finally { searching = false; }
    }, 200);
  });

  function addRecipient(r: RecipientSearchResult) {
    if (!recipients.find(x => x.id === r.id)) recipients = [...recipients, r];
    query = '';
    results = [];
  }
  function removeRecipient(id: string | number) {
    recipients = recipients.filter(x => x.id !== id);
  }

  async function send() {
    if (recipients.length === 0 || !body.trim()) return;
    sending = true; error = '';
    try {
      await createConversation(recipients.map(r => r.id), body, subject, courseFilter || undefined);
      onSent();
      open = false;
      recipients = []; subject = ''; body = ''; query = ''; courseFilter = '';
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      sending = false;
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onclick={() => open = false}>
    <div class="w-[640px] max-w-[92vw] rounded-xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 m-4 overflow-hidden" onclick={(e) => e.stopPropagation()} role="dialog">
      <header class="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 class="text-base font-semibold">New message</h2>
        <button onclick={() => open = false} class="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </header>
      <div class="p-5 space-y-3">
        <div>
          <label class="block text-[11px] uppercase tracking-wider font-medium text-zinc-500 mb-1.5">Course (optional)</label>
          <select bind:value={courseFilter} class="w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <option value="">— Any —</option>
            {#each courses as c}<option value={`course_${c.id}`}>{c.name}</option>{/each}
          </select>
        </div>
        <div>
          <label class="block text-[11px] uppercase tracking-wider font-medium text-zinc-500 mb-1.5">To</label>
          <div class="flex flex-wrap gap-1 mb-1">
            {#each recipients as r}
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style="background: var(--pb-brand-soft); color: var(--pb-brand-strong);">
                {r.name}
                <button onclick={() => removeRecipient(r.id)} class="opacity-60 hover:opacity-100">×</button>
              </span>
            {/each}
          </div>
          <div class="relative">
            <input bind:value={query} placeholder="Search people…"
                   class="w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent" />
            {#if results.length > 0}
              <div class="absolute left-0 right-0 mt-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg max-h-64 overflow-y-auto z-10">
                {#each results as r}
                  <button onclick={() => addRecipient(r)} class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                    {#if r.avatar_url}<img src={r.avatar_url} class="w-6 h-6 rounded-full object-cover bg-zinc-200" alt="" />{:else}<div class="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800"></div>{/if}
                    <span class="truncate">{r.name}</span>
                  </button>
                {/each}
              </div>
            {:else if searching}
              <div class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400">Searching…</div>
            {/if}
          </div>
        </div>
        <div>
          <label class="block text-[11px] uppercase tracking-wider font-medium text-zinc-500 mb-1.5">Subject</label>
          <input bind:value={subject} class="w-full px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent" />
        </div>
        <div>
          <label class="block text-[11px] uppercase tracking-wider font-medium text-zinc-500 mb-1.5">Message</label>
          <textarea bind:value={body} rows="6" placeholder="Type your message…"
                    class="w-full p-3 text-sm rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent resize-y"></textarea>
        </div>
        {#if error}<p class="text-xs text-red-600">{error}</p>{/if}
      </div>
      <footer class="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
        <button onclick={() => open = false} class="px-3 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/60">Cancel</button>
        <button onclick={send} disabled={sending || recipients.length === 0 || !body.trim()}
                class="px-4 py-1.5 text-xs font-medium rounded-md disabled:opacity-50 active:scale-95 transition-transform"
                style="background: var(--pb-brand); color: var(--pb-brand-fg);">
          {sending ? 'Sending…' : 'Send'}
        </button>
      </footer>
    </div>
  </div>
{/if}
