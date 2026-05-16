<script lang="ts">
  import { fetchConversations, fetchConversation, addMessage, updateConversation } from './api';
  import type { ConversationListItem, ConversationFull } from '../../lib/types';
  import Compose from './Compose.svelte';

  type Scope = 'inbox' | 'unread' | 'starred' | 'sent' | 'archived';

  let scope = $state<Scope>('inbox');
  let convs = $state<ConversationListItem[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let selectedId = $state<number | null>(null);
  let detail = $state<ConversationFull | null>(null);
  let detailLoading = $state(false);
  let reply = $state('');
  let sending = $state(false);
  let composeOpen = $state(false);

  async function load() {
    loading = true; error = '';
    try { convs = await fetchConversations(scope); }
    catch (err) { error = err instanceof Error ? err.message : String(err); }
    finally { loading = false; }
  }

  $effect(() => { void scope; load(); });

  async function openConv(id: number) {
    selectedId = id;
    detailLoading = true;
    try {
      detail = await fetchConversation(id);
      // Mark as read
      const item = convs.find(c => c.id === id);
      if (item && item.workflow_state === 'unread') {
        await updateConversation(id, { workflow_state: 'read' }).catch(() => {});
        item.workflow_state = 'read';
        convs = [...convs];
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      detailLoading = false;
    }
  }

  async function sendReply() {
    if (!detail || !reply.trim()) return;
    sending = true;
    try {
      const recipients = (detail.audience ?? []).map(id => String(id));
      const updated = await addMessage(detail.id, reply, recipients);
      detail = updated;
      reply = '';
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      sending = false;
    }
  }

  async function toggleArchive() {
    if (!detail) return;
    const next = detail.workflow_state === 'archived' ? 'read' : 'archived';
    try {
      await updateConversation(detail.id, { workflow_state: next });
      detail = { ...detail, workflow_state: next };
      load();
    } catch {}
  }

  async function toggleStar() {
    if (!detail) return;
    const next = !detail.starred;
    try {
      await updateConversation(detail.id, { starred: next });
      detail = { ...detail, starred: next };
      const item = convs.find(c => c.id === detail!.id);
      if (item) { item.starred = next; convs = [...convs]; }
    } catch {}
  }

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return convs;
    return convs.filter(c =>
      c.subject.toLowerCase().includes(q) ||
      (c.last_message ?? '').toLowerCase().includes(q) ||
      (c.participants ?? []).some(p => (p.name ?? '').toLowerCase().includes(q))
    );
  });

  function relative(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    const ms = Date.now() - d.getTime();
    if (ms < 60_000) return 'now';
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
    if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function initials(name?: string): string {
    if (!name) return '?';
    return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
  }

  function participantsLine(c: ConversationListItem): string {
    return (c.participants ?? []).slice(0, 3).map(p => p.name).join(', ') || c.subject;
  }

  function authorById(id: number): { name: string; avatar?: string } {
    const p = detail?.participants?.find(x => x.id === id);
    return { name: p?.name ?? `User ${id}`, avatar: p?.avatar_url };
  }
</script>

<div class="h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans flex flex-col">

  <!-- Top toolbar -->
  <header class="flex items-center gap-3 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 backdrop-blur-sm flex-shrink-0">
    <div class="flex items-center gap-2 mr-4">
      <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
      <span class="text-[11px] uppercase tracking-[0.08em] text-zinc-400">Inbox</span>
    </div>
    <div class="flex items-center text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {#each [['inbox','Inbox'],['unread','Unread'],['starred','Starred'],['sent','Sent'],['archived','Archived']] as const as [v, label]}
        <button class={`px-3 py-1.5 ${scope === v ? '' : 'bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'}`}
                style={scope === v ? 'background: var(--pb-brand); color: var(--pb-brand-fg);' : ''}
                onclick={() => scope = v}>{label}</button>
      {/each}
    </div>
    <div class="relative flex-1 max-w-md">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
      <input bind:value={search} placeholder="Search conversations…"
             class="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent placeholder:text-zinc-400" />
    </div>
    <button onclick={() => composeOpen = true}
            class="ml-auto px-3 py-1.5 text-xs font-medium rounded-md active:scale-95 transition-transform flex items-center gap-1.5"
            style="background: var(--pb-brand); color: var(--pb-brand-fg);">
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
      Compose
    </button>
  </header>

  <!-- Two-pane body -->
  <div class="flex-1 flex min-h-0">
    <!-- List -->
    <aside class="w-[360px] border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto bg-white dark:bg-zinc-900 flex-shrink-0">
      {#if loading}
        <div class="p-6 text-center text-sm text-zinc-400">Loading conversations…</div>
      {:else if error}
        <div class="p-4 text-xs text-red-600">{error}</div>
      {:else if filtered.length === 0}
        <div class="p-12 text-center text-sm text-zinc-400">{search ? `No matches for "${search}".` : 'No conversations here.'}</div>
      {:else}
        <div class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {#each filtered as c (c.id)}
            {@const unread = c.workflow_state === 'unread'}
            {@const isSelected = selectedId === c.id}
            <button onclick={() => openConv(c.id)}
                    class={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 ${isSelected ? '' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'} ${unread ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}`}
                    style={isSelected ? 'background: var(--pb-brand-soft);' : ''}>
              <div class="relative flex-shrink-0">
                {#if c.avatar_url || c.participants?.[0]?.avatar_url}
                  <img src={c.avatar_url ?? c.participants?.[0]?.avatar_url} alt="" class="w-9 h-9 rounded-full object-cover bg-zinc-100 dark:bg-zinc-800" loading="lazy" />
                {:else}
                  <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold" style="background: color-mix(in srgb, var(--pb-brand) 14%, transparent); color: var(--pb-brand-strong);">{initials(c.participants?.[0]?.name)}</div>
                {/if}
                {#if unread}<span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900" style="background: var(--pb-brand);"></span>{/if}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline gap-2 mb-0.5">
                  <span class={`text-xs truncate ${unread ? 'font-semibold' : ''}`}>{participantsLine(c)}</span>
                  <span class="text-[10px] text-zinc-400 ml-auto flex-shrink-0">{relative(c.last_message_at)}</span>
                </div>
                <div class={`text-xs ${unread ? 'font-semibold' : 'text-zinc-700 dark:text-zinc-300'} truncate`}>{c.subject || '(no subject)'}</div>
                <div class="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{c.last_message ?? ''}</div>
                {#if c.context_name}
                  <div class="text-[10px] text-zinc-400 mt-0.5 truncate">{c.context_name}</div>
                {/if}
              </div>
              {#if c.starred}<svg class="w-3 h-3 text-amber-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>{/if}
            </button>
          {/each}
        </div>
      {/if}
    </aside>

    <!-- Detail -->
    <main class="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 flex flex-col min-w-0">
      {#if !selectedId}
        <div class="flex-1 flex items-center justify-center text-sm text-zinc-400">
          <div class="text-center">
            <div class="text-4xl mb-3">✉️</div>
            <div>Select a conversation to read.</div>
          </div>
        </div>
      {:else if detailLoading && !detail}
        <div class="flex-1 flex items-center justify-center text-sm text-zinc-400">Loading…</div>
      {:else if detail}
        <header class="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start justify-between gap-3 flex-shrink-0">
          <div class="min-w-0">
            <h1 class="text-lg font-semibold leading-tight truncate">{detail.subject || '(no subject)'}</h1>
            {#if detail.context_name}<div class="text-[11px] text-zinc-500 mt-0.5">{detail.context_name}</div>{/if}
            <div class="flex flex-wrap gap-1 mt-2">
              {#each (detail.participants ?? []).slice(0, 6) as p}
                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">{p.name}</span>
              {/each}
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button onclick={toggleStar} class="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title={detail.starred ? 'Unstar' : 'Star'}>
              <svg class={`w-4 h-4 ${detail.starred ? 'text-amber-400' : 'text-zinc-400'}`} fill={detail.starred ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.518-4.674z" /></svg>
            </button>
            <button onclick={toggleArchive} class="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title={detail.workflow_state === 'archived' ? 'Unarchive' : 'Archive'}>
              <svg class="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            </button>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {#each [...detail.messages].reverse() as m (m.id)}
            {@const author = authorById(m.author_id)}
            <article class="flex gap-3">
              {#if author.avatar}
                <img src={author.avatar} alt="" class="w-9 h-9 rounded-full object-cover bg-zinc-100 dark:bg-zinc-800 flex-shrink-0" loading="lazy" />
              {:else}
                <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style="background: color-mix(in srgb, var(--pb-brand) 14%, transparent); color: var(--pb-brand-strong);">{initials(author.name)}</div>
              {/if}
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline gap-2 mb-1">
                  <span class="text-sm font-medium">{author.name}</span>
                  <span class="text-[11px] text-zinc-400">{new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                <div class="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 text-sm prose prose-sm dark:prose-invert max-w-none [&_a]:underline whitespace-pre-wrap">{m.body}</div>
                {#if m.attachments && m.attachments.length > 0}
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    {#each m.attachments as att}
                      <a href={att.url} class="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        {att.display_name}
                      </a>
                    {/each}
                  </div>
                {/if}
              </div>
            </article>
          {/each}
        </div>

        <!-- Reply composer -->
        <div class="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex-shrink-0">
          <textarea bind:value={reply} placeholder="Reply…" rows="3"
                    class="w-full p-3 text-sm rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent resize-y"></textarea>
          <div class="flex items-center justify-between mt-2">
            <span class="text-[11px] text-zinc-400">Cmd+Enter to send</span>
            <button onclick={sendReply} disabled={sending || !reply.trim()}
                    class="px-4 py-1.5 text-xs font-medium rounded-md disabled:opacity-50 active:scale-95 transition-transform"
                    style="background: var(--pb-brand); color: var(--pb-brand-fg);">
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      {/if}
    </main>
  </div>

  <Compose bind:open={composeOpen} onSent={() => load()} />
</div>
