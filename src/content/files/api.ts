import { fetchAllPages, fetchWithRetry, CanvasApiError } from '../../lib/canvas-api';
import type { FolderFull, FileFull } from '../../lib/types';

async function jsonGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithRetry(url, { signal });
  if (!res.ok) throw new CanvasApiError(`${res.status} on ${url}`, res.status);
  return res.json();
}

export function fetchCourseFolders(courseId: number, signal?: AbortSignal): Promise<FolderFull[]> {
  return fetchAllPages<FolderFull>(`/api/v1/courses/${courseId}/folders?per_page=100`, { signal });
}

export function fetchFolderFiles(folderId: number, signal?: AbortSignal): Promise<FileFull[]> {
  return fetchAllPages<FileFull>(`/api/v1/folders/${folderId}/files?per_page=100`, { signal });
}

export function fetchFolderSubfolders(folderId: number, signal?: AbortSignal): Promise<FolderFull[]> {
  return fetchAllPages<FolderFull>(`/api/v1/folders/${folderId}/folders?per_page=100`, { signal });
}

export function fetchRootFolder(courseId: number, signal?: AbortSignal): Promise<FolderFull> {
  return jsonGet<FolderFull>(`/api/v1/courses/${courseId}/folders/root`, signal);
}
