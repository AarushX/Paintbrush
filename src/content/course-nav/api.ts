import { fetchWithRetry, CanvasApiError } from '../../lib/canvas-api';
import type { CourseTab } from '../../lib/types';

// The course's navigation tabs — the exact list Canvas shows in its
// left-hand course nav (including external tools), in the configured
// order and with per-tab visibility.
export async function fetchCourseTabs(courseId: number, signal?: AbortSignal): Promise<CourseTab[]> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}/tabs?per_page=50`, { signal });
  if (!res.ok) throw new CanvasApiError(`${res.status} on course tabs`, res.status);
  return res.json();
}
