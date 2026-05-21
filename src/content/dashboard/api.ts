import { fetchAllPages, fetchWithRetry, canvasPut, CanvasApiError } from '../../lib/canvas-api';
import type { DashboardCard, CanvasUserSelf, PlannerItem, Announcement, CourseWithScore } from '../../lib/types';

async function jsonGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithRetry(url, { signal });
  if (!res.ok) throw new CanvasApiError(`${res.status} on ${url}`, res.status);
  return res.json();
}

export function fetchDashboardCards(signal?: AbortSignal): Promise<DashboardCard[]> {
  return jsonGet('/api/v1/dashboard/dashboard_cards', signal);
}

export function fetchSelf(signal?: AbortSignal): Promise<CanvasUserSelf> {
  return jsonGet('/api/v1/users/self', signal);
}

export function fetchPlanner(signal?: AbortSignal): Promise<PlannerItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  return fetchAllPages<PlannerItem>(
    `/api/v1/planner/items?start_date=${today}&end_date=${future}&per_page=50`,
    { signal }
  );
}

export function fetchRecentAnnouncements(courseIds: number[], signal?: AbortSignal): Promise<Announcement[]> {
  if (courseIds.length === 0) return Promise.resolve([]);
  const params = new URLSearchParams();
  for (const cid of courseIds) params.append('context_codes[]', `course_${cid}`);
  params.set('per_page', '20');
  params.set('latest_only', 'true');
  params.set('active_only', 'false');
  params.set('start_date', new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10));
  params.set('end_date', new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  return jsonGet<Announcement[]>(`/api/v1/announcements?${params.toString()}`, signal).catch(() => []);
}

// Persist a course ordering to Canvas itself (the same endpoint the native
// dashboard's drag-and-drop uses), so the new order sticks across reloads
// and is consistent everywhere Canvas reads dashboard positions.
export function saveDashboardPositions(userId: number, orderedCourseIds: number[]): Promise<unknown> {
  const dashboard_positions: Record<string, number> = {};
  orderedCourseIds.forEach((id, idx) => { dashboard_positions[`course_${id}`] = idx; });
  return canvasPut(`/api/v1/users/${userId}/dashboard_positions`, { dashboard_positions });
}

export function fetchCoursesWithScores(signal?: AbortSignal): Promise<CourseWithScore[]> {
  return fetchAllPages<CourseWithScore>(
    `/api/v1/courses?enrollment_state=active&include[]=total_scores&include[]=course_image&per_page=50`,
    { signal }
  );
}
