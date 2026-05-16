<script lang="ts">
  import { markdownToHtml } from './markdown-mini';

  let {
    placeholder = 'Write a reply…',
    onSubmit,
    onCancel = () => {},
    submitting = false
  }: {
    placeholder?: string;
    onSubmit: (html: string) => void | Promise<void>;
    onCancel?: () => void;
    submitting?: boolean;
  } = $props();

  let text = $state('');
  let preview = $state(false);
  let textarea: HTMLTextAreaElement | undefined = $state();

  function wrap(prefix: string, suffix: string = prefix) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);
    text = text.slice(0, start) + prefix + selected + suffix + text.slice(end);
    queueMicrotask(() => {
      textarea?.focus();
      if (textarea) {
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd = end + prefix.length;
      }
    });
  }

  function onKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  async function submit() {
    if (!text.trim() || submitting) return;
    const html = markdownToHtml(text);
    await onSubmit(html);
    text = '';
  }
</script>

<div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
  <div class="flex items-center justify-between gap-1 px-2 py-1 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-950/30">
    <div class="flex items-center gap-0.5">
      <button class="px-2 py-1 text-xs rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 font-bold" onclick={() => wrap('**')} title="Bold (⌘B)">B</button>
      <button class="px-2 py-1 text-xs rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 italic" onclick={() => wrap('*')} title="Italic (⌘I)">I</button>
      <button class="px-2 py-1 text-xs rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 font-mono" onclick={() => wrap('`')} title="Code">{'</>'}</button>
      <button class="px-2 py-1 text-xs rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60" onclick={() => wrap('[', '](https://)')} title="Link">🔗</button>
    </div>
    <div class="flex items-center gap-1">
      <button class={`px-2 py-1 text-[11px] rounded ${preview ? 'bg-zinc-200/60 dark:bg-zinc-800/60' : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'}`} onclick={() => preview = !preview}>{preview ? 'Edit' : 'Preview'}</button>
    </div>
  </div>
  {#if preview}
    <div class="prose prose-sm dark:prose-invert max-w-none p-3 min-h-[80px] text-sm">
      {@html markdownToHtml(text) || '<em class="text-zinc-400">Nothing to preview yet…</em>'}
    </div>
  {:else}
    <textarea
      bind:this={textarea}
      bind:value={text}
      onkeydown={onKeyDown}
      {placeholder}
      class="block w-full p-3 text-sm bg-transparent outline-none resize-y min-h-[80px] max-h-[300px] placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
      rows="3"></textarea>
  {/if}
  <div class="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-950/30">
    <span class="text-[11px] text-zinc-400 dark:text-zinc-600">Markdown · ⌘↵ to send</span>
    <div class="flex items-center gap-1.5">
      <button class="px-3 py-1 text-xs rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60" onclick={onCancel}>Cancel</button>
      <button class="px-3 py-1 text-xs rounded font-medium disabled:opacity-50 active:scale-95 transition-transform"
              style="background: var(--pb-brand); color: var(--pb-brand-fg);"
              disabled={submitting || !text.trim()}
              onclick={submit}>
        {submitting ? 'Posting…' : 'Post'}
      </button>
    </div>
  </div>
</div>
