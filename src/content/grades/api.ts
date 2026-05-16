import { fetchAllPages, fetchWithRetry, CanvasApiError } from '../../lib/canvas-api';
import type { CourseWithMeta, AssignmentGroupWithScores } from '../../lib/types';

async function jsonGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithRetry(url, { signal });
  if (!res.ok) throw new CanvasApiError(`${res.status} on ${url}`, res.status);
  return res.json();
}

export function fetchCourseScores(courseId: number, signal?: AbortSignal): Promise<CourseWithMeta> {
  return jsonGet(`/api/v1/courses/${courseId}?include[]=total_scores&include[]=current_grading_period_scores&include[]=term`, signal);
}

export function fetchAssignmentGroupsWithSubmissions(courseId: number, signal?: AbortSignal): Promise<AssignmentGroupWithScores[]> {
  return fetchAllPages<AssignmentGroupWithScores>(
    `/api/v1/courses/${courseId}/assignment_groups?include[]=assignments&include[]=submission&per_page=100`,
    { signal }
  );
}
