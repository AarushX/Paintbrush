<script lang="ts">
  import { getLocal, setLocal } from '../lib/storage';
  import { onMount } from 'svelte';

  let domains = $state<string[]>([]);
  let sidebarDefaultOpen = $state(true);
  let newDomain = $state('');
  let error = $state('');

  onMount(async () => {
    domains = await getLocal('customDomains');
    sidebarDefaultOpen = await getLocal('sidebarDefaultOpen');
  });

  function normalize(d: string): string | null {
    const trimmed = d.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) return null;
    return trimmed.toLowerCase();
  }

  async function addDomain() {
    error = '';
    const norm = normalize(newDomain);
    if (!norm) { error = 'Enter a valid hostname (e.g. canvas.myschool.edu)'; return; }
    if (domains.includes(norm)) { error = 'Already added.'; return; }
    const origin = `*://${norm}/*`;
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) { error = 'Permission denied.'; return; }
    try {
      await chrome.scripting.registerContentScripts([{
        id: `paintbrush-${norm}`,
        matches: [origin],
        js: ['src/content/index.ts'],
        runAt: 'document_idle'
      }]);
    } catch {
      await chrome.scripting.updateContentScripts([{
        id: `paintbrush-${norm}`,
        matches: [origin],
        js: ['src/content/index.ts'],
        runAt: 'document_idle'
      }]);
    }
    domains = [...domains, norm];
    await setLocal('customDomains', domains);
    newDomain = '';
  }

  async function removeDomain(d: string) {
    const origin = `*://${d}/*`;
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [`paintbrush-${d}`] });
    } catch { /* already gone */ }
    await chrome.permissions.remove({ origins: [origin] });
    domains = domains.filter((x) => x !== d);
    await setLocal('customDomains', domains);
  }

  async function toggleDefaultOpen() {
    sidebarDefaultOpen = !sidebarDefaultOpen;
    await setLocal('sidebarDefaultOpen', sidebarDefaultOpen);
  }
</script>

<main class="mx-auto max-w-2xl p-8">
  <h1 class="text-2xl font-semibold tracking-tight">Paintbrush</h1>
  <p class="mt-1 text-sm text-zinc-500">Options for the Canvas LMS extension.</p>

  <section class="mt-8">
    <h2 class="text-base font-semibold">Custom Canvas domains</h2>
    <p class="mt-1 text-sm text-zinc-500">Paintbrush works on *.instructure.com out of the box. Add your school's domain here if it uses a custom URL.</p>

    <div class="mt-4 flex gap-2">
      <input
        bind:value={newDomain}
        type="text"
        placeholder="canvas.myschool.edu"
        class="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm" />
      <button onclick={addDomain}
              class="rounded bg-indigo-600 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-700">
        Add
      </button>
    </div>
    {#if error}<p class="mt-2 text-xs text-red-600">{error}</p>{/if}

    {#if domains.length > 0}
      <ul class="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 rounded border border-zinc-200 dark:border-zinc-800">
        {#each domains as d}
          <li class="flex items-center justify-between px-4 py-2">
            <code class="text-sm">{d}</code>
            <button onclick={() => removeDomain(d)} class="text-xs text-red-600 hover:underline">Remove</button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="mt-10">
    <h2 class="text-base font-semibold">Defaults</h2>
    <label class="mt-3 flex items-center gap-3 text-sm cursor-pointer">
      <input type="checkbox" checked={sidebarDefaultOpen} onchange={toggleDefaultOpen} />
      Show sidebar by default when opening Canvas pages
    </label>
  </section>
</main>
