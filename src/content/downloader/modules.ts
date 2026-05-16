import { fetchAllPages, fetchWithRetry, CanvasApiError } from '../../lib/canvas-api';
import { createZip, generateZipBlob, joinPath, safeFilename, safeFolderName, triggerDownload } from './zip';
import { openProgress } from './progress-host.svelte';
import { htmlToMarkdown, extractCanvasFileRefs, rewriteCanvasFileLinks } from './markdown';
import type { Course, Module, Page, Assignment, CanvasFile } from '../../lib/types';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function frontmatter(fields: Record<string, string>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) lines.push(`${k}: ${JSON.stringify(v)}`);
  lines.push('---', '');
  return lines.join('\n');
}

async function fetchCourse(courseId: number, signal: AbortSignal): Promise<Course> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}`, { signal });
  if (!res.ok) throw new CanvasApiError(`course ${courseId}`, res.status);
  return res.json();
}

async function fetchModules(courseId: number, signal: AbortSignal): Promise<Module[]> {
  return fetchAllPages<Module>(
    `/api/v1/courses/${courseId}/modules?include[]=items&include[]=content_details&per_page=100`,
    { signal }
  );
}

async function fetchPage(courseId: number, pageUrl: string, signal: AbortSignal): Promise<Page> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`, { signal });
  if (!res.ok) throw new CanvasApiError(`page ${pageUrl}`, res.status);
  return res.json();
}

async function fetchAssignment(courseId: number, id: number, signal: AbortSignal): Promise<Assignment> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}/assignments/${id}`, { signal });
  if (!res.ok) throw new CanvasApiError(`assignment ${id}`, res.status);
  return res.json();
}

async function fetchFile(courseId: number, id: number, signal: AbortSignal): Promise<CanvasFile> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}/files/${id}`, { signal });
  if (!res.ok) throw new CanvasApiError(`file ${id}`, res.status);
  return res.json();
}

async function fetchBlob(url: string, signal: AbortSignal): Promise<Blob> {
  const res = await fetchWithRetry(url, { signal });
  if (!res.ok) throw new CanvasApiError(`blob ${url}`, res.status);
  return res.blob();
}

interface ExportStats {
  modules: number;
  items: number;
  pagesAsMarkdown: number;
  filesIncluded: number;
  failures: Array<{ module: string; item: string; reason: string }>;
}

function renderAssignmentMd(a: Assignment, courseHtmlUrl: string): string {
  const meta = frontmatter({
    title: a.name,
    points: String(a.points_possible),
    due_at: a.due_at ?? '',
    source: a.html_url || courseHtmlUrl
  });
  const body = a.description ? htmlToMarkdown(a.description) : '_(no description)_\n';
  return meta + `# ${a.name}\n\n` + body;
}

function renderPageMd(p: Page, body: string): string {
  return frontmatter({
    title: p.title,
    updated: p.updated_at,
    source: p.html_url
  }) + `# ${p.title}\n\n` + body;
}

function renderManifest(course: Course, stats: ExportStats): string {
  const lines = [
    `# ${course.name} — modules export`,
    '',
    `Exported: ${new Date().toISOString()}`,
    `Course: ${course.course_code} (id ${course.id})`,
    '',
    '## Summary',
    `- Modules: ${stats.modules}`,
    `- Items processed: ${stats.items}`,
    `- Pages exported as Markdown: ${stats.pagesAsMarkdown}`,
    `- Files included: ${stats.filesIncluded}`,
    `- Failures: ${stats.failures.length}`,
    ''
  ];
  if (stats.failures.length > 0) {
    lines.push('## Failures', '');
    for (const f of stats.failures) {
      lines.push(`- **${f.module} → ${f.item}**: ${f.reason}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export async function exportModules(courseId: number): Promise<void> {
  const controller = new AbortController();
  const progress = openProgress({ title: 'Listing modules…' });
  progress.onCancel(() => controller.abort());

  const stats: ExportStats = {
    modules: 0, items: 0, pagesAsMarkdown: 0, filesIncluded: 0, failures: []
  };

  try {
    const [course, modules] = await Promise.all([
      fetchCourse(courseId, controller.signal),
      fetchModules(courseId, controller.signal)
    ]);

    const zip = createZip();
    stats.modules = modules.length;
    const totalItems = modules.reduce((acc, m) => acc + (m.items?.length ?? 0), 0);
    let processed = 0;
    progress.update({ title: 'Exporting modules…', total: totalItems });

    for (const [mi, mod] of modules.entries()) {
      const modFolder = `${pad2(mi + 1)}-${safeFolderName(mod.name)}`;
      const readme: string[] = [`# ${mod.name}`, ''];
      const assetCache = new Map<number, { localPath: string; name: string }>();

      for (const [ii, item] of (mod.items ?? []).entries()) {
        if (controller.signal.aborted) break;
        const idx = pad2(ii + 1);
        progress.update({ currentFile: `${mod.name} → ${item.title}` });

        try {
          switch (item.type) {
            case 'File': {
              if (item.content_id == null) break;
              const meta = await fetchFile(courseId, item.content_id, controller.signal);
              const blob = await fetchBlob(meta.url, controller.signal);
              const fname = `${idx}-${safeFilename(meta.display_name || meta.filename)}`;
              zip.file(joinPath(modFolder, fname), blob);
              readme.push(`- [${item.title}](${fname})`);
              stats.filesIncluded += 1;
              break;
            }
            case 'Page': {
              if (!item.page_url) break;
              const page = await fetchPage(courseId, item.page_url, controller.signal);
              const refs = extractCanvasFileRefs(page.body);
              for (const ref of refs) {
                if (assetCache.has(ref.fileId)) continue;
                try {
                  const meta = await fetchFile(courseId, ref.fileId, controller.signal);
                  const blob = await fetchBlob(meta.url, controller.signal);
                  const aname = safeFilename(meta.display_name || meta.filename);
                  zip.file(joinPath(modFolder, '_assets', aname), blob);
                  assetCache.set(ref.fileId, { localPath: joinPath('_assets', aname), name: aname });
                } catch {
                  // asset failure is non-fatal
                }
              }
              const rewritten = rewriteCanvasFileLinks(page.body, {
                resolveAssetPath: (id) => assetCache.get(id)?.localPath ?? '#'
              });
              const md = renderPageMd(page, htmlToMarkdown(rewritten));
              const mdName = `${idx}-${safeFilename(page.title)}.md`;
              zip.file(joinPath(modFolder, mdName), md);
              readme.push(`- [${item.title}](${mdName})`);
              stats.pagesAsMarkdown += 1;
              break;
            }
            case 'Assignment': {
              if (item.content_id == null) break;
              const a = await fetchAssignment(courseId, item.content_id, controller.signal);
              const md = renderAssignmentMd(a, course.id ? `/courses/${course.id}` : '');
              const mdName = `${idx}-${safeFilename(a.name)}.md`;
              zip.file(joinPath(modFolder, mdName), md);
              readme.push(`- [${item.title}](${mdName})`);
              break;
            }
            case 'Quiz':
            case 'Discussion': {
              const mdName = `${idx}-${safeFilename(item.title)}.md`;
              const meta = frontmatter({ title: item.title, source: item.html_url ?? '' });
              zip.file(joinPath(modFolder, mdName), meta + `# ${item.title}\n\nSee Canvas: ${item.html_url ?? ''}\n`);
              readme.push(`- [${item.title}](${mdName})`);
              break;
            }
            case 'ExternalUrl':
            case 'ExternalTool': {
              readme.push(`- [${item.title}](${item.external_url ?? item.html_url ?? '#'})`);
              break;
            }
            case 'SubHeader': {
              readme.push('', `## ${item.title}`, '');
              break;
            }
          }
          stats.items += 1;
        } catch (err) {
          stats.failures.push({
            module: mod.name,
            item: item.title,
            reason: err instanceof Error ? err.message : String(err)
          });
        } finally {
          processed += 1;
          progress.update({ completed: processed });
        }
      }

      zip.file(joinPath(modFolder, 'README.md'), readme.join('\n') + '\n');
    }

    if (controller.signal.aborted) {
      progress.cancelled();
      return;
    }

    zip.file('manifest.md', renderManifest(course, stats));

    progress.update({ title: 'Packaging ZIP…', currentFile: '' });
    const blob = await generateZipBlob(zip);
    const filename = `${safeFilename(course.course_code || course.name)}-modules.zip`;
    triggerDownload(blob, filename);
    progress.done(`Saved ${filename}`);
  } catch (err) {
    if (controller.signal.aborted) {
      progress.cancelled();
      return;
    }
    progress.error(err instanceof Error ? err.message : String(err));
  }
}
