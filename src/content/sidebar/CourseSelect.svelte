<script lang="ts">
  // A compact, modern course picker for the sidebar. Scales gracefully:
  // a handful of courses shows as a plain list; many courses get a search
  // box so the list stays navigable.
  interface CourseOption {
    id: number;
    name: string;
    code?: string;
    color?: string | null;
  }

  let { courses, selectedId, onSelect }: {
    courses: CourseOption[];
    selectedId: number | null;
    onSelect: (id: number) => void;
  } = $props();

  let open = $state(false);
  let query = $state('');
  let rootEl: HTMLElement;

  const selected = $derived(courses.find(c => c.id === selectedId) ?? null);
  // Only surface the search field once the list is long enough to need it.
  const showSearch = $derived(courses.length > 7);
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(c =>
      c.name.toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q));
  });

  function pick(id: number) {
    onSelect(id);
    open = false;
    query = '';
  }
  function toggle() {
    open = !open;
    if (!open) query = '';
  }

  // Close on outside click / Escape while the popover is open.
  $effect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      // The sidebar lives in a shadow root, so `e.target` on the document
      // listener is retargeted to the shadow host. composedPath() sees the
      // real click path through the shadow boundary.
      if (rootEl && !e.composedPath().includes(rootEl)) { open = false; query = ''; }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { open = false; query = ''; }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  });
</script>

<div class="relative" bind:this={rootEl}>
  <button onclick={toggle}
          class="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-[var(--pb-brand)] transition-colors text-left">
    <span class="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={`background: ${selected?.color ?? 'var(--pb-brand)'};`}></span>
    <div class="min-w-0 flex-1">
      <div class="text-[12px] font-semibold truncate">
        {selected ? selected.name : 'Select a course'}
      </div>
      {#if selected?.code}
        <div class="text-[10px] text-zinc-400 truncate">{selected.code}</div>
      {/if}
    </div>
    <svg class={`w-3.5 h-3.5 text-zinc-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
         fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {#if open}
    <div class="absolute left-0 right-0 mt-1 z-[60] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
      {#if showSearch}
        <div class="p-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
          <div class="relative">
            <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <!-- svelte-ignore a11y_autofocus -->
            <input bind:value={query} autofocus placeholder="Search courses…"
                   class="w-full pl-7 pr-2 py-1.5 text-[11px] rounded bg-zinc-100/70 dark:bg-zinc-800/50 border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] placeholder:text-zinc-400" />
          </div>
        </div>
      {/if}
      <div class="max-h-64 overflow-y-auto py-1">
        {#each filtered as c (c.id)}
          {@const isSel = c.id === selectedId}
          <button onclick={() => pick(c.id)}
                  class={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${isSel
                    ? ''
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                  style={isSel ? 'background: var(--pb-brand-soft);' : ''}>
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style={`background: ${c.color ?? 'var(--pb-brand)'};`}></span>
            <div class="min-w-0 flex-1">
              <div class={`text-[12px] truncate ${isSel ? 'font-semibold' : 'font-medium'}`}
                   style={isSel ? 'color: var(--pb-brand-strong);' : ''}>{c.name}</div>
              {#if c.code}<div class="text-[10px] text-zinc-400 truncate">{c.code}</div>{/if}
            </div>
            {#if isSel}
              <svg class="w-3.5 h-3.5 flex-shrink-0" style="color: var(--pb-brand-strong);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            {/if}
          </button>
        {/each}
        {#if filtered.length === 0}
          <div class="px-3 py-4 text-center text-[11px] text-zinc-400">No courses match "{query}".</div>
        {/if}
      </div>
    </div>
  {/if}
</div>
