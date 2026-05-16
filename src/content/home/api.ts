import { fetchAllPages, fetchWithRetry, CanvasApiError } from '../../lib/canvas-api';
import type { CourseWithMeta, AssignmentListItem, Announcement } from '../../lib/types';

async function jsonGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithRetry(url, { signal });
  if (!res.ok) throw new CanvasApiError(`${res.status} on ${url}`, res.status);
  return res.json();
}

export function fetchCourseFull(courseId: number, signal?: AbortSignal): Promise<CourseWithMeta> {
  return jsonGet(`/api/v1/courses/${courseId}?include[]=syllabus_body&include[]=total_scores&include[]=term&include[]=course_image`, signal);
}

export function fetchUpcomingAssignments(courseId: number, signal?: AbortSignal): Promise<AssignmentListItem[]> {
  // bucket=upcoming returns assignments due within the next two weeks
  return fetchAllPages<AssignmentListItem>(
    `/api/v1/courses/${courseId}/assignments?bucket=upcoming&include[]=submission&per_page=10`,
    { signal }
  );
}

export function fetchRecentAnnouncements(courseId: number, signal?: AbortSignal): Promise<Announcement[]> {
  return fetchAllPages<Announcement>(
    `/api/v1/announcements?context_codes[]=course_${courseId}&per_page=5&active_only=false&start_date=1970-01-01&end_date=${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}`,
    { signal }
  );
}
