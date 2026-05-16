import { fetchAllPages, fetchWithRetry, canvasPost, CanvasApiError } from '../../lib/canvas-api';
import type { AssignmentFull, AssignmentListItem, AssignmentGroup, Submission } from '../../lib/types';

async function jsonGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithRetry(url, { signal });
  if (!res.ok) throw new CanvasApiError(`${res.status} on ${url}`, res.status);
  return res.json();
}

export function fetchAssignment(courseId: number, id: number, signal?: AbortSignal): Promise<AssignmentFull> {
  return jsonGet(`/api/v1/courses/${courseId}/assignments/${id}?include[]=submission`, signal);
}

export function fetchAssignmentList(courseId: number, signal?: AbortSignal): Promise<AssignmentListItem[]> {
  return fetchAllPages<AssignmentListItem>(
    `/api/v1/courses/${courseId}/assignments?include[]=submission&per_page=100&order_by=due_at`,
    { signal }
  );
}

export function fetchAssignmentGroups(courseId: number, signal?: AbortSignal): Promise<AssignmentGroup[]> {
  return fetchAllPages<AssignmentGroup>(
    `/api/v1/courses/${courseId}/assignment_groups?include[]=assignments&include[]=submission&per_page=100`,
    { signal }
  );
}

export function submitTextEntry(courseId: number, assignmentId: number, body: string, signal?: AbortSignal): Promise<Submission> {
  return canvasPost<Submission>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
    { submission: { submission_type: 'online_text_entry', body } },
    { signal }
  );
}

export function submitUrl(courseId: number, assignmentId: number, url: string, signal?: AbortSignal): Promise<Submission> {
  return canvasPost<Submission>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
    { submission: { submission_type: 'online_url', url } },
    { signal }
  );
}
