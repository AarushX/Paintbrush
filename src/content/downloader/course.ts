import { fetchAllPages, fetchWithRetry, CanvasApiError } from '../../lib/canvas-api';
import { createZip, generateZipBlob, joinPath, safeFilename, safeFolderName, triggerDownload } from './zip';
import { openProgress } from './progress-host.svelte';
import { htmlToMarkdown } from './markdown';
import type {
  CourseWithSyllabus, Folder, CanvasFile, Module, Page, Assignment,
  Announcement, DiscussionTopic, DiscussionView, DiscussionEntry
} from '../../lib/types';

const CONCURRENCY = 4;

// ---------- helpers ----------

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function frontmatter(fields: Record<string, string>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) lines.push(`${k}: ${JSON.stringify(v)}`);
  lines.push('---', '');
  return lines.join('\n');
}

async function fetchBlob(url: string, signal: AbortSignal): Promise<Blob> {
  const res = await fetchWithRetry(url, { signal, maxRetries: 3 });
  if (!res.ok) throw new CanvasApiError(`Download failed: ${res.status}`, res.status);
  return res.blob();
}

async function withConcurrency<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  concurrency: number,
  signal: AbortSignal
): Promise<void> {
  let cursor = 0;
  async function next(): Promise<void> {
    while (true) {
      if (signal.aborted) return;
      const i = cursor++;
      if (i >= items.length) return;
      await worker(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => next()));
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetchWithRetry(url, { signal });
  if (!res.ok) throw new CanvasApiError(`${res.status} on ${url}`, res.status);
  return res.json();
}

// ---------- fetchers ----------

function fetchCourse(id: number, signal: AbortSignal): Promise<CourseWithSyllabus> {
  return fetchJson<CourseWithSyllabus>(`/api/v1/courses/${id}?include[]=syllabus_body`, signal);
}

function fetchFolders(id: number, signal: AbortSignal): Promise<Folder[]> {
  return fetchAllPages<Folder>(`/api/v1/courses/${id}/folders?per_page=100`, { signal });
}

function fetchFilesForFolder(fid: number, signal: AbortSignal): Promise<CanvasFile[]> {
  return fetchAllPages<CanvasFile>(`/api/v1/folders/${fid}/files?per_page=100`, { signal });
}

function fetchModules(id: number, signal: AbortSignal): Promise<Module[]> {
  return fetchAllPages<Module>(
    `/api/v1/courses/${id}/modules?include[]=items&include[]=content_details&per_page=100`,
    { signal }
  );
}

function fetchPages(id: number, signal: AbortSignal): Promise<Array<{ url: string; title: string }>> {
  return fetchAllPages(`/api/v1/courses/${id}/pages?per_page=100`, { signal });
}

function fetchPage(courseId: number, pageUrl: string, signal: AbortSignal): Promise<Page> {
  return fetchJson<Page>(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`, signal);
}

function fetchAssignments(id: number, signal: AbortSignal): Promise<Assignment[]> {
  return fetchAllPages<Assignment>(`/api/v1/courses/${id}/assignments?per_page=100`, { signal });
}

function fetchAnnouncements(courseId: number, signal: AbortSignal): Promise<Announcement[]> {
  return fetchAllPages<Announcement>(
    `/api/v1/announcements?context_codes[]=course_${courseId}&per_page=100&active_only=false&start_date=1970-01-01&end_date=${new Date().toISOString().slice(0, 10)}`,
    { signal }
  );
}

function fetchDiscussionTopics(id: number, signal: AbortSignal): Promise<DiscussionTopic[]> {
  return fetchAllPages<DiscussionTopic>(`/api/v1/courses/${id}/discussion_topics?per_page=100`, { signal });
}

function fetchDiscussionView(courseId: number, topicId: number, signal: AbortSignal): Promise<DiscussionView> {
  return fetchJson<DiscussionView>(`/api/v1/courses/${courseId}/discussion_topics/${topicId}/view`, signal);
}

// ---------- renderers ----------

function renderAnnouncementMd(a: Announcement): string {
  return (
    frontmatter({
      title: a.title,
      posted_at: a.posted_at ?? '',
      author: a.author?.display_name ?? '',
      source: a.html_url
    }) +
    `# ${a.title}\n\n` +
    (a.message ? htmlToMarkdown(a.message) : '')
  );
}

function renderDiscussionMd(
  t: DiscussionTopic,
  view: DiscussionView | null,
  participantsById: Map<number, string>
): string {
  const lines: string[] = [];
  lines.push(
    frontmatter({
      title: t.title,
      posted_at: t.posted_at ?? '',
      author: t.author?.display_name ?? '',
      source: t.html_url
    })
  );
  lines.push(`# ${t.title}`, '');
  if (t.message) lines.push(htmlToMarkdown(t.message));
  if (view && view.view.length > 0) {
    lines.push('', '---', '', '## Replies', '');
    const renderEntries = (entries: DiscussionEntry[], depth: number) => {
      for (const e of entries) {
        const name = participantsById.get(e.user_id) ?? `User ${e.user_id}`;
        const prefix = '  '.repeat(depth) + '- ';
        lines.push(`${prefix}**${name}** (${e.created_at})`);
        const body = e.message
          ? htmlToMarkdown(e.message)
              .split('\n')
              .map((l) => '  '.repeat(depth + 1) + l)
              .join('\n')
          : '';
        if (body.trim()) lines.push(body);
        if (e.replies && e.replies.length > 0) renderEntries(e.replies, depth + 1);
      }
    };
    renderEntries(view.view, 0);
  }
  return lines.join('\n') + '\n';
}

function renderPageMd(p: Page): string {
  return (
    frontmatter({ title: p.title, updated: p.updated_at, source: p.html_url }) +
    `# ${p.title}\n\n` +
    (p.body ? htmlToMarkdown(p.body) : '')
  );
}

function renderAssignmentMd(a: Assignment): string {
  return (
    frontmatter({
      title: a.name,
      points: String(a.points_possible),
      due_at: a.due_at ?? '',
      source: a.html_url
    }) +
    `# ${a.name}\n\n` +
    (a.description ? htmlToMarkdown(a.description) : '_(no description)_\n')
  );
}

function renderManifest(course: CourseWithSyllabus, stats: ExportStats): string {
  const lines: string[] = [
    `# ${course.name} — Full course export`,
    '',
    `Exported: ${new Date().toISOString()}`,
    `Course: ${course.course_code} (id ${course.id})`,
    '',
    '## Counts',
    `- Files: ${stats.files}`,
    `- Modules: ${stats.modules}`,
    `- Announcements: ${stats.announcements}`,
    `- Discussions: ${stats.discussions}`,
    `- Pages: ${stats.pages}`,
    `- Assignments: ${stats.assignments}`,
    `- Failures: ${stats.failures.length}`,
    ''
  ];
  if (stats.failures.length > 0) {
    lines.push('## Failures', '');
    for (const f of stats.failures) {
      lines.push(`- **[${f.section}]** ${f.item}: ${f.reason}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ---------- main ----------

interface ExportStats {
  files: number;
  modules: number;
  pages: number;
  assignments: number;
  announcements: number;
  discussions: number;
  failures: Array<{ section: string; item: string; reason: string }>;
}

export async function exportEntireCourse(courseId: number): Promise<void> {
  const controller = new AbortController();
  const progress = openProgress({ title: 'Preparing full export…' });
  progress.onCancel(() => controller.abort());

  const stats: ExportStats = {
    files: 0,
    modules: 0,
    pages: 0,
    assignments: 0,
    announcements: 0,
    discussions: 0,
    failures: []
  };

  try {
    const course = await fetchCourse(courseId, controller.signal);
    const zip = createZip();

    // ===== 1. SYLLABUS =====
    progress.update({ title: 'Exporting syllabus…', currentFile: 'syllabus.md' });
    if (course.syllabus_body) {
      const md =
        frontmatter({
          title: `${course.name} — Syllabus`,
          source: `/courses/${course.id}/assignments/syllabus`
        }) +
        `# ${course.name} — Syllabus\n\n` +
        htmlToMarkdown(course.syllabus_body);
      zip.file('syllabus.md', md);
    }

    // ===== 2. FILES =====
    progress.update({ title: 'Listing files…', currentFile: '' });
    const folders = await fetchFolders(courseId, controller.signal);
    const pathByFolder = new Map<number, string>();
    for (const f of folders) {
      const parts = f.full_name.split('/').slice(1).map(safeFolderName);
      pathByFolder.set(f.id, parts.join('/'));
    }
    const filesPending: Array<{ file: CanvasFile; path: string }> = [];
    for (const f of folders) {
      const folderPath = pathByFolder.get(f.id) ?? '';
      try {
        const inFolder = await fetchFilesForFolder(f.id, controller.signal);
        for (const file of inFolder) filesPending.push({ file, path: folderPath });
      } catch (err) {
        // 403 on a locked/restricted folder is common — skip and record.
        stats.failures.push({
          section: 'files',
          item: folderPath || f.name || `folder-${f.id}`,
          reason: err instanceof Error ? err.message : String(err)
        });
      }
    }
    progress.update({ title: 'Downloading files…', total: filesPending.length, completed: 0 });
    let filesDone = 0;
    await withConcurrency(
      filesPending,
      async ({ file, path }) => {
        const fname = safeFilename(file.display_name || file.filename || `file-${file.id}`);
        progress.update({ currentFile: fname });
        try {
          const blob = await fetchBlob(file.url, controller.signal);
          const dest = path
            ? joinPath('files', path, fname)
            : joinPath('files', fname);
          zip.file(dest, blob);
          stats.files += 1;
        } catch (err) {
          stats.failures.push({
            section: 'files',
            item: fname,
            reason: err instanceof Error ? err.message : String(err)
          });
        } finally {
          filesDone += 1;
          progress.update({ completed: filesDone });
        }
      },
      CONCURRENCY,
      controller.signal
    );

    // ===== 3. MODULES =====
    progress.update({ title: 'Exporting modules…', currentFile: '', total: 0, completed: 0 });
    const modules = await fetchModules(courseId, controller.signal);
    stats.modules = modules.length;
    for (const [mi, mod] of modules.entries()) {
      const folder = `modules/${pad2(mi + 1)}-${safeFolderName(mod.name)}`;
      const readme: string[] = [`# ${mod.name}`, ''];
      for (const [ii, it] of (mod.items ?? []).entries()) {
        const idx = pad2(ii + 1);
        try {
          switch (it.type) {
            case 'File':
              readme.push(`- ${it.title} — see \`../../files/\``);
              break;
            case 'Page': {
              if (!it.page_url) break;
              const page = await fetchPage(courseId, it.page_url, controller.signal);
              const md = renderPageMd(page);
              zip.file(joinPath(folder, `${idx}-${safeFilename(page.title)}.md`), md);
              readme.push(`- [${it.title}](${idx}-${safeFilename(page.title)}.md)`);
              break;
            }
            case 'Assignment':
              readme.push(`- ${it.title} — see \`../../assignments/\``);
              break;
            case 'Quiz':
            case 'Discussion':
              readme.push(`- ${it.title} — see \`../../discussions/\` or Canvas`);
              break;
            case 'ExternalUrl':
            case 'ExternalTool':
              readme.push(`- [${it.title}](${it.external_url ?? it.html_url ?? '#'})`);
              break;
            case 'SubHeader':
              readme.push('', `## ${it.title}`, '');
              break;
          }
        } catch (err) {
          stats.failures.push({
            section: 'modules',
            item: `${mod.name} → ${it.title}`,
            reason: err instanceof Error ? err.message : String(err)
          });
        }
      }
      zip.file(joinPath(folder, 'README.md'), readme.join('\n') + '\n');
    }

    // ===== 4. ANNOUNCEMENTS =====
    progress.update({ title: 'Exporting announcements…', currentFile: '' });
    const anns = await fetchAnnouncements(courseId, controller.signal).catch((err) => {
      stats.failures.push({
        section: 'announcements',
        item: '(list)',
        reason: err instanceof Error ? err.message : String(err)
      });
      return [] as Announcement[];
    });
    anns.sort((a, b) => (a.posted_at ?? '').localeCompare(b.posted_at ?? ''));
    for (const [i, a] of anns.entries()) {
      const fname = `announcements/${pad2(i + 1)}-${safeFilename(a.title)}.md`;
      try {
        zip.file(fname, renderAnnouncementMd(a));
        stats.announcements += 1;
      } catch (err) {
        stats.failures.push({
          section: 'announcements',
          item: a.title,
          reason: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // ===== 5. DISCUSSIONS =====
    progress.update({ title: 'Exporting discussions…', currentFile: '' });
    const topics = await fetchDiscussionTopics(courseId, controller.signal).catch((err) => {
      stats.failures.push({
        section: 'discussions',
        item: '(list)',
        reason: err instanceof Error ? err.message : String(err)
      });
      return [] as DiscussionTopic[];
    });
    for (const [i, t] of topics.entries()) {
      const fname = `discussions/${pad2(i + 1)}-${safeFilename(t.title)}.md`;
      try {
        progress.update({ currentFile: t.title });
        let view: DiscussionView | null = null;
        try {
          view = await fetchDiscussionView(courseId, t.id, controller.signal);
        } catch {
          // /view requires the user to have viewed the discussion; non-fatal
        }
        const participantsById = new Map<number, string>();
        if (view) {
          for (const p of view.participants) participantsById.set(p.id, p.display_name);
        }
        zip.file(fname, renderDiscussionMd(t, view, participantsById));
        stats.discussions += 1;
      } catch (err) {
        stats.failures.push({
          section: 'discussions',
          item: t.title,
          reason: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // ===== 6. PAGES =====
    progress.update({ title: 'Exporting pages…', currentFile: '' });
    const pageList = await fetchPages(courseId, controller.signal).catch((err) => {
      stats.failures.push({
        section: 'pages',
        item: '(list)',
        reason: err instanceof Error ? err.message : String(err)
      });
      return [] as Array<{ url: string; title: string }>;
    });
    for (const [i, pmeta] of pageList.entries()) {
      try {
        progress.update({ currentFile: pmeta.title });
        const page = await fetchPage(courseId, pmeta.url, controller.signal);
        zip.file(`pages/${pad2(i + 1)}-${safeFilename(page.title)}.md`, renderPageMd(page));
        stats.pages += 1;
      } catch (err) {
        stats.failures.push({
          section: 'pages',
          item: pmeta.title,
          reason: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // ===== 7. ASSIGNMENTS =====
    progress.update({ title: 'Exporting assignments…', currentFile: '' });
    const assignments = await fetchAssignments(courseId, controller.signal).catch((err) => {
      stats.failures.push({
        section: 'assignments',
        item: '(list)',
        reason: err instanceof Error ? err.message : String(err)
      });
      return [] as Assignment[];
    });
    for (const [i, a] of assignments.entries()) {
      try {
        zip.file(`assignments/${pad2(i + 1)}-${safeFilename(a.name)}.md`, renderAssignmentMd(a));
        stats.assignments += 1;
      } catch (err) {
        stats.failures.push({
          section: 'assignments',
          item: a.name,
          reason: err instanceof Error ? err.message : String(err)
        });
      }
    }

    if (controller.signal.aborted) {
      progress.cancelled();
      return;
    }

    // ===== 8. MANIFEST =====
    zip.file('manifest.md', renderManifest(course, stats));

    // ===== 9. ZIP =====
    progress.update({ title: 'Packaging ZIP…', currentFile: '' });
    const blob = await generateZipBlob(zip);
    const filename = `${safeFilename(course.course_code || course.name)}-full-export.zip`;
    triggerDownload(blob, filename);
    progress.done(
      `Saved ${filename}${stats.failures.length > 0 ? ` (${stats.failures.length} failures — see manifest.md)` : ''}`
    );
  } catch (err) {
    if (controller.signal.aborted) {
      progress.cancelled();
      return;
    }
    progress.error(err instanceof Error ? err.message : String(err));
  }
}
