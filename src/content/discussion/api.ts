import { fetchWithRetry, canvasPost, CanvasApiError } from '../../lib/canvas-api';
import type { DiscussionTopicFull, DiscussionViewFull, DiscussionEntryFull } from '../../lib/types';

async function jsonGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithRetry(url, { signal });
  if (!res.ok) throw new CanvasApiError(`${res.status} on ${url}`, res.status);
  return res.json();
}

export function fetchTopic(courseId: number, topicId: number, signal?: AbortSignal): Promise<DiscussionTopicFull> {
  return jsonGet(`/api/v1/courses/${courseId}/discussion_topics/${topicId}`, signal);
}

export function fetchView(courseId: number, topicId: number, signal?: AbortSignal): Promise<DiscussionViewFull> {
  return jsonGet(`/api/v1/courses/${courseId}/discussion_topics/${topicId}/view`, signal);
}

export function postEntry(
  courseId: number,
  topicId: number,
  message: string,
  signal?: AbortSignal
): Promise<DiscussionEntryFull> {
  return canvasPost<DiscussionEntryFull>(
    `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries`,
    { message },
    { signal }
  );
}

export function postReply(
  courseId: number,
  topicId: number,
  parentEntryId: number,
  message: string,
  signal?: AbortSignal
): Promise<DiscussionEntryFull> {
  return canvasPost<DiscussionEntryFull>(
    `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries/${parentEntryId}/replies`,
    { message },
    { signal }
  );
}

export async function markEntryRead(
  courseId: number,
  topicId: number,
  entryId: number,
  signal?: AbortSignal
): Promise<void> {
  // Canvas accepts PUT on the read endpoint; ignore CSRF specifics by reusing canvasPost-like flow.
  const csrfCookie = document.cookie.split(';').find(c => c.trim().startsWith('_csrf_token='));
  const csrf = csrfCookie ? decodeURIComponent(csrfCookie.split('=').slice(1).join('=').trim()) : null;
  const res = await fetch(
    `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries/${entryId}/read`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Accept': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      signal
    }
  );
  if (!res.ok && res.status !== 204) throw new CanvasApiError(`${res.status} on mark-read`, res.status);
}
