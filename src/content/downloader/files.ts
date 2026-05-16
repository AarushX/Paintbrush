import { fetchAllPages, fetchWithRetry, CanvasApiError } from '../../lib/canvas-api';
import { createZip, generateZipBlob, joinPath, safeFilename, safeFolderName, triggerDownload } from './zip';
import { openProgress } from './progress-host.svelte';
import type { Course, Folder, CanvasFile } from '../../lib/types';

const CONCURRENCY = 4;

async function fetchCourse(courseId: number, signal: AbortSignal): Promise<Course> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}`, { signal });
  if (!res.ok) throw new CanvasApiError(`Failed to fetch course ${courseId}`, res.status);
  return res.json();
}

async function fetchFolders(courseId: number, signal: AbortSignal): Promise<Folder[]> {
  return fetchAllPages<Folder>(`/api/v1/courses/${courseId}/folders?per_page=100`, { signal });
}

async function fetchFilesForFolder(folderId: number, signal: AbortSignal): Promise<CanvasFile[]> {
  return fetchAllPages<CanvasFile>(`/api/v1/folders/${folderId}/files?per_page=100`, { signal });
}

interface PendingFile {
  file: CanvasFile;
  folderPath: string;
}

function buildFolderPaths(folders: Folder[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const f of folders) {
    const parts = f.full_name.split('/').slice(1).map(safeFolderName);
    map.set(f.id, parts.join('/'));
  }
  return map;
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

export async function downloadAllFiles(courseId: number): Promise<void> {
  const controller = new AbortController();
  const progress = openProgress({ title: 'Listing files…' });
  progress.onCancel(() => controller.abort());

  const failures: Array<{ name: string; reason: string }> = [];

  try {
    const [course, folders] = await Promise.all([
      fetchCourse(courseId, controller.signal),
      fetchFolders(courseId, controller.signal)
    ]);

    const pathByFolder = buildFolderPaths(folders);
    const pending: PendingFile[] = [];
    for (const f of folders) {
      const folderPath = pathByFolder.get(f.id) ?? '';
      try {
        const files = await fetchFilesForFolder(f.id, controller.signal);
        for (const file of files) pending.push({ file, folderPath });
      } catch (err) {
        // 403 on a locked/restricted folder is common — skip and record.
        failures.push({
          name: folderPath || f.name || `folder-${f.id}`,
          reason: err instanceof Error ? err.message : String(err)
        });
      }
    }

    const zip = createZip();
    let completed = 0;
    progress.update({ title: 'Downloading files…', total: pending.length, completed: 0 });

    await withConcurrency(
      pending,
      async ({ file, folderPath }) => {
        const fname = safeFilename(file.display_name || file.filename || `file-${file.id}`);
        progress.update({ currentFile: fname });
        try {
          const blob = await fetchBlob(file.url, controller.signal);
          zip.file(joinPath(folderPath, fname) || fname, blob);
        } catch (err) {
          failures.push({ name: fname, reason: err instanceof Error ? err.message : String(err) });
        } finally {
          completed += 1;
          progress.update({ completed });
        }
      },
      CONCURRENCY,
      controller.signal
    );

    if (controller.signal.aborted) {
      progress.cancelled();
      return;
    }

    if (failures.length > 0) {
      const lines = ['# Failed downloads', '', ...failures.map(f => `- ${f.name}: ${f.reason}`)];
      zip.file('FAILURES.md', lines.join('\n'));
    }

    progress.update({ title: 'Packaging ZIP…', currentFile: '' });
    const blob = await generateZipBlob(zip);
    const filename = `${safeFilename(course.course_code || course.name)}-files.zip`;
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
