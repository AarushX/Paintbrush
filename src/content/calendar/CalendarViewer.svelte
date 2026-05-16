<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchEvents, fetchUserContexts, fetchSelfId, discoverIcalUrl } from './api';
  import type { CalendarEvent } from '../../lib/types';

  let viewDate = $state(new Date());
  let view = $state<'month' | 'week' | 'agenda'>('month');
  let events = $state<CalendarEvent[]>([]);
  let contexts = $state<Array<{ code: string; name: string; color: string }>>([]);
  let loading = $state(true);
  let error = $state('');
  let selected = $state<CalendarEvent | null>(null);

  let icalUrl = $state<string | null>(null);
  let subscribeOpen = $state(false);
  let icalLoading = $state(false);
  let copied = $state(false);

  function startOfMonth(d: Date) { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
  function endOfMonth(d: Date) { const x = startOfMonth(d); x.setMonth(x.getMonth() + 1); x.setMilliseconds(-1); return x; }
  function startOfWeek(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - x.getDay()); return x; }
  function endOfWeek(d: Date) { const x = startOfWeek(d); x.setDate(x.getDate() + 6); x.setHours(23,59,59,999); return x; }
  function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }

  async function load() {
    loading = true; error = '';
    try {
      const [cards, selfId] = await Promise.all([
        fetchUserContexts().catch(() => []),
        fetchSelfId()
      ]);
      const ctxList: Array<{ code: string; name: string; color: string }> = [];
      for (const c of cards) {
        ctxList.push({
          code: `course_${c.id}`,
          name: c.originalName ?? c.shortName ?? c.longName ?? `Course ${c.id}`,
          color: c.color ?? '#4f46e5'
        });
      }
      if (selfId != null) ctxList.push({ code: `user_${selfId}`, name: 'Personal', color: '#71717a' });
      contexts = ctxList;

      const start = new Date(viewDate);
      start.setDate(start.getDate() - 14);
      const end = new Date(viewDate);
      end.setDate(end.getDate() + 45);

      const startISO = start.toISOString().slice(0, 10);
      const endISO = end.toISOString().slice(0, 10);
      const codes = ctxList.map(c => c.code);

      const [ev, asg] = await Promise.all([
        fetchEvents(codes, startISO, endISO, 'event').catch(() => []),
        fetchEvents(codes, startISO, endISO, 'assignment').catch(() => [])
      ]);
      // Tag types and dedupe
      const seen = new Set<string>();
      const all: CalendarEvent[] = [];
      for (const e of [...ev, ...asg]) {
        const k = `${e.id}:${e.type ?? ''}`;
        if (seen.has(k)) continue;
        seen.add(k);
        all.push(e);
      }
      events = all;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  // Reload when viewDate's month changes
  let lastMonthKey = '';
  $effect(() => {
    const key = `${viewDate.getFullYear()}-${viewDate.getMonth()}`;
    if (key !== lastMonthKey) {
      lastMonthKey = key;
      load();
    }
  });

  onMount(() => { load(); });

  function colorFor(e: CalendarEvent): string {
    const ctx = contexts.find(c => c.code === e.context_code);
    return ctx?.color ?? 'var(--pb-brand)';
  }

  function eventStart(e: CalendarEvent): Date | null {
    const iso = e.start_at ?? e.assignment?.due_at;
    return iso ? new Date(iso) : null;
  }

  function eventEnd(e: CalendarEvent): Date | null {
    return e.end_at ? new Date(e.end_at) : null;
  }

  // Month grid: 6 rows × 7 columns starting from Sunday of the first week
  const monthGrid = $derived.by(() => {
    const first = startOfMonth(viewDate);
    const gridStart = startOfWeek(first);
    const cells: Date[] = [];
    const cur = new Date(gridStart);
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  });

  function eventsForDay(day: Date): CalendarEvent[] {
    return events
      .filter(e => {
        const s = eventStart(e);
        return s && sameDay(s, day);
      })
      .sort((a, b) => {
        const aa = eventStart(a)?.getTime() ?? 0;
        const bb = eventStart(b)?.getTime() ?? 0;
        return aa - bb;
      });
  }

  // Week grid: 7 days starting Sunday of viewDate's week
  const weekDays = $derived.by(() => {
    const start = startOfWeek(viewDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return d;
    });
  });

  // Agenda: events from today onward (up to 30 days), grouped by date
  const agendaGroups = $derived.by(() => {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(end.getDate() + 30);
    const inWindow = events
      .filter(e => {
        const s = eventStart(e); return s && s >= start && s <= end;
      })
      .sort((a, b) => (eventStart(a)?.getTime() ?? 0) - (eventStart(b)?.getTime() ?? 0));
    const groups: Array<{ key: string; date: Date; items: CalendarEvent[] }> = [];
    for (const e of inWindow) {
      const s = eventStart(e)!;
      const dayKey = s.toDateString();
      let g = groups.find(x => x.key === dayKey);
      if (!g) { g = { key: dayKey, date: new Date(s), items: [] }; groups.push(g); }
      g.items.push(e);
    }
    return groups;
  });

  function fmtTime(d: Date): string {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function fmtMonthYear(d: Date): string {
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function goPrev() {
    if (view === 'month') {
      const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); viewDate = d;
    } else if (view === 'week') {
      const d = new Date(viewDate); d.setDate(d.getDate() - 7); viewDate = d;
    } else {
      const d = new Date(viewDate); d.setDate(d.getDate() - 30); viewDate = d;
    }
  }
  function goNext() {
    if (view === 'month') {
      const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); viewDate = d;
    } else if (view === 'week') {
      const d = new Date(viewDate); d.setDate(d.getDate() + 7); viewDate = d;
    } else {
      const d = new Date(viewDate); d.setDate(d.getDate() + 30); viewDate = d;
    }
  }
  function goToday() { viewDate = new Date(); }

  async function openSubscribe() {
    subscribeOpen = !subscribeOpen;
    if (subscribeOpen && icalUrl == null && !icalLoading) {
      icalLoading = true;
      icalUrl = await discoverIcalUrl();
      icalLoading = false;
    }
  }

  async function copyIcal() {
    if (!icalUrl) return;
    try { await navigator.clipboard.writeText(icalUrl); copied = true; setTimeout(() => copied = false, 1500); } catch {}
  }

  function addToGoogle() {
    if (!icalUrl) return;
    const url = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(icalUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Time grid for week view (7am to 10pm by default)
  const HOUR_START = 7;
  const HOUR_END = 22;
  const HOUR_PX = 48;

  function eventTopPx(e: CalendarEvent): number {
    const s = eventStart(e);
    if (!s) return 0;
    const mins = (s.getHours() - HOUR_START) * 60 + s.getMinutes();
    return Math.max(0, (mins / 60) * HOUR_PX);
  }
  function eventHeightPx(e: CalendarEvent): number {
    const s = eventStart(e);
    const en = eventEnd(e);
    if (!s) return 24;
    const endTime = en ?? new Date(s.getTime() + 60 * 60 * 1000);
    const dur = (endTime.getTime() - s.getTime()) / 60_000;
    return Math.max(24, (dur / 60) * HOUR_PX);
  }
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-6xl mx-auto px-6 py-6">

    <!-- Header -->
    <header class="mb-4 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-1">
          <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
          Calendar
        </div>
        <h1 class="text-2xl font-semibold tracking-tight">{fmtMonthYear(viewDate)}</h1>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
          <button onclick={goPrev} class="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l-md transition-colors" aria-label="Previous">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onclick={goToday} class="px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 border-x border-zinc-200 dark:border-zinc-800">Today</button>
          <button onclick={goNext} class="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r-md transition-colors" aria-label="Next">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <div class="flex items-center text-[11px] rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {#each [['month','Month'],['week','Week'],['agenda','Agenda']] as const as [v, label]}
            <button class={`px-3 py-1.5 ${view === v ? '' : 'bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'}`}
                    style={view === v ? 'background: var(--pb-brand); color: var(--pb-brand-fg);' : ''}
                    onclick={() => view = v}>{label}</button>
          {/each}
        </div>
        <div class="relative">
          <button onclick={openSubscribe}
                  class="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-[var(--pb-brand)] hover:text-[var(--pb-brand-strong)] transition-colors flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            Subscribe
          </button>
          {#if subscribeOpen}
            <div class="absolute right-0 top-full mt-2 w-80 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-20 p-3 text-xs">
              <div class="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-500 mb-2">Add to Google Calendar</div>
              {#if icalLoading}
                <p class="text-zinc-500 py-2">Looking up your feed URL&hellip;</p>
              {:else if icalUrl}
                <p class="text-zinc-600 dark:text-zinc-400 mb-2">Your Canvas calendar will sync into Google Calendar automatically.</p>
                <div class="flex items-center gap-1 mb-3 p-1.5 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800">
                  <input readonly value={icalUrl} class="flex-1 bg-transparent text-[10px] font-mono truncate outline-none" />
                  <button onclick={copyIcal} class="px-2 py-0.5 text-[10px] rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60">{copied ? '✓' : 'Copy'}</button>
                </div>
                <button onclick={addToGoogle}
                        class="w-full px-3 py-2 text-xs font-medium rounded-md active:scale-95 transition-transform"
                        style="background: var(--pb-brand); color: var(--pb-brand-fg);">
                  Open Google Calendar
                </button>
              {:else}
                <p class="text-zinc-500 mb-2">Couldn&apos;t auto-discover your iCal feed URL. Open Canvas&apos;s calendar and copy the Calendar Feed URL, then paste it here:</p>
                <input bind:value={icalUrl} type="url" placeholder="https://&hellip;/feeds/calendars/user_&hellip;ics"
                       class="w-full px-2 py-1.5 text-[10px] rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 mb-2" />
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </header>

    {#if error}
      <div class="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {/if}

    <!-- Month view -->
    {#if view === 'month'}
      <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div class="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
          {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as wd}
            <div class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2 py-1.5 text-center">{wd}</div>
          {/each}
        </div>
        <div class="grid grid-cols-7" style="grid-auto-rows: minmax(110px, auto);">
          {#each monthGrid as day, i}
            {@const inMonth = day.getMonth() === viewDate.getMonth()}
            {@const isToday = sameDay(day, new Date())}
            {@const dayEvents = eventsForDay(day)}
            <div class={`border-b border-r border-zinc-100 dark:border-zinc-800/60 p-1.5 relative ${i % 7 === 6 ? 'border-r-0' : ''} ${inMonth ? '' : 'bg-zinc-50/50 dark:bg-zinc-950/30'}`}
                 style={isToday ? 'background: var(--pb-brand-soft);' : ''}>
              <div class={`text-[11px] font-medium ${isToday ? 'inline-flex items-center justify-center w-5 h-5 rounded-full' : ''} ${inMonth ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-600'}`}
                   style={isToday ? 'background: var(--pb-brand); color: var(--pb-brand-fg);' : ''}>
                {day.getDate()}
              </div>
              <div class="mt-1 space-y-0.5">
                {#each dayEvents.slice(0, 3) as e (e.id + ':' + (e.type ?? ''))}
                  {@const s = eventStart(e)}
                  <button onclick={() => selected = e} class="w-full text-left px-1 py-0.5 rounded text-[10px] truncate flex items-center gap-1 hover:opacity-80 transition-opacity"
                          style={`background: color-mix(in srgb, ${colorFor(e)} 18%, transparent); color: color-mix(in srgb, ${colorFor(e)} 75%, black);`}>
                    {#if !e.all_day && s}<span class="font-medium tabular-nums">{fmtTime(s)}</span>{/if}
                    <span class="truncate">{e.title}</span>
                  </button>
                {/each}
                {#if dayEvents.length > 3}
                  <button class="text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-1">+{dayEvents.length - 3} more</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Week view -->
    {#if view === 'week'}
      <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div class="grid border-b border-zinc-200 dark:border-zinc-800" style="grid-template-columns: 48px repeat(7, 1fr);">
          <div></div>
          {#each weekDays as d}
            {@const isToday = sameDay(d, new Date())}
            <div class="text-center px-2 py-2 border-l border-zinc-100 dark:border-zinc-800/60">
              <div class="text-[10px] uppercase tracking-wider text-zinc-500">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
              <div class={`text-sm font-semibold mt-0.5 inline-flex items-center justify-center ${isToday ? 'w-6 h-6 rounded-full' : ''}`}
                   style={isToday ? 'background: var(--pb-brand); color: var(--pb-brand-fg);' : ''}>{d.getDate()}</div>
            </div>
          {/each}
        </div>
        <div class="relative" style={`height: ${(HOUR_END - HOUR_START) * HOUR_PX}px;`}>
          <div class="absolute inset-0 grid" style="grid-template-columns: 48px repeat(7, 1fr);">
            <div>
              {#each Array(HOUR_END - HOUR_START) as _, idx}
                <div class="text-[9px] text-zinc-400 text-right pr-1 -mt-1.5" style={`height: ${HOUR_PX}px;`}>
                  {(HOUR_START + idx) % 12 || 12}{(HOUR_START + idx) < 12 ? 'a' : 'p'}
                </div>
              {/each}
            </div>
            {#each weekDays as d}
              <div class="relative border-l border-zinc-100 dark:border-zinc-800/60">
                {#each Array(HOUR_END - HOUR_START) as _, idx}
                  <div class="border-b border-zinc-100 dark:border-zinc-800/30" style={`height: ${HOUR_PX}px;`}></div>
                {/each}
                {#each events.filter(e => { const s = eventStart(e); return s && sameDay(s, d) && !e.all_day; }) as e (e.id + ':' + (e.type ?? ''))}
                  {@const s = eventStart(e)}
                  <button onclick={() => selected = e}
                          class="absolute left-0.5 right-0.5 rounded text-[10px] text-left p-1 overflow-hidden hover:opacity-90 transition-opacity"
                          style={`top: ${eventTopPx(e)}px; height: ${eventHeightPx(e)}px; background: color-mix(in srgb, ${colorFor(e)} 18%, transparent); border-left: 2px solid ${colorFor(e)}; color: color-mix(in srgb, ${colorFor(e)} 80%, black);`}>
                    <div class="font-semibold tabular-nums">{s ? fmtTime(s) : ''}</div>
                    <div class="truncate">{e.title}</div>
                  </button>
                {/each}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Agenda view -->
    {#if view === 'agenda'}
      {#if agendaGroups.length === 0}
        <div class="py-16 text-center text-sm text-zinc-400">No events in the next 30 days.</div>
      {:else}
        <div class="space-y-4">
          {#each agendaGroups as g}
            <div>
              <div class="flex items-baseline gap-2 mb-2">
                <span class="text-sm font-semibold">{g.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                <span class="text-[11px] text-zinc-400">{g.items.length} event{g.items.length === 1 ? '' : 's'}</span>
              </div>
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-hidden">
                {#each g.items as e (e.id + ':' + (e.type ?? ''))}
                  {@const s = eventStart(e)}
                  <button onclick={() => selected = e} class="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors flex items-start gap-3">
                    <span class="w-1 self-stretch rounded-full flex-shrink-0" style={`background: ${colorFor(e)};`}></span>
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-medium truncate">{e.title}</div>
                      <div class="text-[11px] text-zinc-500 mt-0.5">
                        {#if e.all_day}All day{:else if s}{fmtTime(s)}{/if}
                        {#if e.context_name}<span> &middot; {e.context_name}</span>{/if}
                      </div>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Event detail modal -->
    {#if selected}
      <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onclick={() => selected = null}>
        <div class="w-[480px] max-w-[90vw] rounded-xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 p-5 m-4" onclick={(e) => e.stopPropagation()} role="dialog">
          <div class="flex items-start gap-2 mb-3">
            <span class="w-1 self-stretch rounded-full flex-shrink-0" style={`background: ${colorFor(selected)};`}></span>
            <div class="flex-1 min-w-0">
              <h2 class="text-lg font-semibold leading-tight">{selected.title}</h2>
              {#if selected.context_name}
                <div class="text-[11px] text-zinc-500 mt-0.5">{selected.context_name}</div>
              {/if}
            </div>
            <button onclick={() => selected = null} class="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            {#if eventStart(selected)}
              {#each [eventStart(selected)!] as s}
                <div><span class="font-medium text-zinc-700 dark:text-zinc-300">When:</span> {selected.all_day ? s.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) + ' (all day)' : s.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
              {/each}
            {/if}
            {#if selected.location_name}
              <div><span class="font-medium text-zinc-700 dark:text-zinc-300">Where:</span> {selected.location_name}{selected.location_address ? ` · ${selected.location_address}` : ''}</div>
            {/if}
          </div>
          {#if selected.description}
            <div class="prose prose-sm dark:prose-invert max-w-none mb-4 [&_a]:underline">{@html selected.description}</div>
          {/if}
          {#if selected.html_url || selected.assignment?.html_url}
            <a href={selected.html_url ?? selected.assignment?.html_url} class="inline-flex items-center gap-1 text-xs font-medium" style="color: var(--pb-brand-strong);">
              Open in Canvas
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
            </a>
          {/if}
        </div>
      </div>
    {/if}

    {#if loading && events.length === 0}
      <div class="absolute inset-0 pointer-events-none flex items-center justify-center bg-white/40 dark:bg-zinc-950/40 z-10 rounded-lg">
        <div class="text-sm text-zinc-400">Loading events&hellip;</div>
      </div>
    {/if}

  </div>
</div>
