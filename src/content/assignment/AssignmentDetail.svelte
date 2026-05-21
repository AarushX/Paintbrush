<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchAssignment, submitTextEntry, submitUrl } from './api';
  import type { AssignmentFull } from '../../lib/types';

  let { courseId, assignmentId, onShowCanvas }: {
    courseId: number;
    assignmentId: number;
    onShowCanvas: () => void;
  } = $props();

  let assignment = $state<AssignmentFull | null>(null);
  let loading = $state(true);
  let error = $state('');
  let submitting = $state(false);
  let textBody = $state('');
  let urlBody = $state('');

  async function load() {
    loading = true; error = '';
    try {
      assignment = await fetchAssignment(courseId, assignmentId);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }
  onMount(load);

  function relativeDue(iso: string | null): string {
    if (!iso) return 'No due date';
    const d = new Date(iso);
    const ms = d.getTime() - Date.now();
    const absH = Math.abs(ms) / 3_600_000;
    if (ms > 0 && absH < 24) return `Due in ${Math.round(absH)}h`;
    if (ms < 0 && absH < 24) return `Due ${Math.round(absH)}h ago`;
    return d.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  async function doTextSubmit() {
    if (!textBody.trim() || !assignment) return;
    submitting = true;
    try {
      await submitTextEntry(courseId, assignment.id, textBody);
      textBody = '';
      await load();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      submitting = false;
    }
  }

  async function doUrlSubmit() {
    if (!urlBody.trim() || !assignment) return;
    submitting = true;
    try {
      await submitUrl(courseId, assignment.id, urlBody);
      urlBody = '';
      await load();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      submitting = false;
    }
  }

  const submission = $derived(assignment?.submission);
  const submissionTypes = $derived(assignment?.submission_types ?? []);
  const supportsText = $derived(submissionTypes.includes('online_text_entry'));
  const supportsUrl = $derived(submissionTypes.includes('online_url'));
</script>

<div class="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
  <div class="max-w-5xl mx-auto px-6 py-8">
    {#if loading && !assignment}
      <div class="py-16 text-center text-sm text-zinc-400">Loading assignment…</div>
    {:else if error && !assignment}
      <div class="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
    {:else if assignment}
      <header class="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800/50">
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-2">
          <span class="w-1.5 h-1.5 rounded-full" style="background: var(--pb-brand);"></span>
          Assignment
        </div>
        <h1 class="text-2xl font-semibold tracking-tight mb-3">{assignment.name}</h1>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span><span class="font-medium text-zinc-700 dark:text-zinc-300">Due:</span> {relativeDue(assignment.due_at)}</span>
          <span>·</span>
          <span><span class="font-medium text-zinc-700 dark:text-zinc-300">{assignment.points_possible ?? 0}</span> pts</span>
          {#if assignment.submission?.workflow_state === 'graded' && assignment.submission.score != null}
            <span>·</span>
            <span style="color: var(--pb-brand-strong); font-weight: 600;">Graded: {assignment.submission.score}/{assignment.points_possible}</span>
          {:else if submission?.workflow_state === 'submitted'}
            <span>·</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-medium">Submitted</span>
          {/if}
        </div>
        <div class="flex flex-wrap gap-1.5 mt-3">
          {#each submissionTypes as t}
            <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">{t.replace(/_/g, ' ')}</span>
          {/each}
        </div>
      </header>

      {#if assignment.description}
        <div class="prose prose-sm dark:prose-invert max-w-none mb-8 [&_a]:underline [&_a]:text-inherit">{@html assignment.description}</div>
      {:else}
        <div class="text-sm italic text-zinc-400 mb-8">No description provided.</div>
      {/if}

      <!-- Submission section -->
      <section class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div class="text-[11px] uppercase tracking-[0.08em] text-zinc-400 mb-3">Submit</div>
        {#if submission && (submission.workflow_state === 'submitted' || submission.workflow_state === 'graded')}
          <div class="mb-4 text-xs text-zinc-500">
            Last submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '—'} (attempt {submission.attempt ?? 1})
          </div>
        {/if}
        {#if supportsText}
          <div class="mb-4">
            <label for="pb-text-entry" class="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Text entry</label>
            <textarea id="pb-text-entry" bind:value={textBody}
                      placeholder="Write your response…"
                      rows="6"
                      class="w-full p-3 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent resize-y"></textarea>
            <div class="flex justify-end mt-2">
              <button onclick={doTextSubmit} disabled={submitting || !textBody.trim()}
                      class="px-4 py-1.5 text-xs font-medium rounded-md disabled:opacity-50 active:scale-95 transition-transform"
                      style="background: var(--pb-brand); color: var(--pb-brand-fg);">
                {submitting ? 'Submitting…' : 'Submit text entry'}
              </button>
            </div>
          </div>
        {/if}
        {#if supportsUrl}
          <div class="mb-4">
            <label for="pb-url-entry" class="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">URL</label>
            <div class="flex gap-2">
              <input id="pb-url-entry" type="url" bind:value={urlBody} placeholder="https://…"
                     class="flex-1 px-3 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-[var(--pb-brand)] focus:border-transparent" />
              <button onclick={doUrlSubmit} disabled={submitting || !urlBody.trim()}
                      class="px-4 py-1.5 text-xs font-medium rounded-md disabled:opacity-50 active:scale-95 transition-transform"
                      style="background: var(--pb-brand); color: var(--pb-brand-fg);">
                Submit URL
              </button>
            </div>
          </div>
        {/if}
        {#if !supportsText && !supportsUrl}
          <p class="text-xs text-zinc-500 mb-3">This assignment requires a file upload, quiz, or other submission method.</p>
        {/if}
        <div class="flex justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
          <button onclick={onShowCanvas}
                  class="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-1">
            Show Canvas submission form
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </section>
    {/if}
  </div>
</div>
