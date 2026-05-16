<script lang="ts">
  let { open = $bindable(true) }: { open?: boolean } = $props();
</script>

<aside class={`fixed right-0 top-0 z-[2147483647] h-screen bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-sans transition-transform ${!open ? 'translate-x-[calc(100%-44px)]' : 'translate-x-0'}`}
       style="width: 320px;">
  <header class="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800">
    <h2 class="text-sm font-semibold tracking-tight">Paintbrush</h2>
    <button class="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            onclick={() => open = !open}>
      {open ? 'Hide' : 'Show'}
    </button>
  </header>
  <div class="p-3 text-sm text-zinc-500">Sidebar bootstrapped.</div>
</aside>
