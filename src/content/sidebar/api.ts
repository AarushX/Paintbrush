import { fetchAllPages, canvasPost } from '../../lib/canvas-api';
import type { PlannerItem, CourseColors } from '../../lib/types';
import { getLocal, setLocal, getSession, setSession } from '../../lib/storage';

const PLANNER_CACHE_TTL_MS = 5 * 60_000;
const COLORS_CACHE_TTL_MS = 24 * 60 * 60_000;

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function fetchPlannerItems(): Promise<PlannerItem[]> {
  const url = `/api/v1/planner/items?start_date=${isoDateOffset(-7)}&end_date=${isoDateOffset(30)}&per_page=50`;
  return fetchAllPages<PlannerItem>(url);
}

export async function getCachedPlannerItems(): Promise<PlannerItem[] | null> {
  const cache = await getSession('plannerCache');
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > PLANNER_CACHE_TTL_MS) return null;
  return cache.items as PlannerItem[];
}

export async function setCachedPlannerItems(items: PlannerItem[]): Promise<void> {
  await setSession('plannerCache', { items, fetchedAt: Date.now() });
}

export async function getCourseColors(): Promise<Record<string, string>> {
  const fetchedAt = await getLocal('courseColorsFetchedAt');
  if (Date.now() - fetchedAt < COLORS_CACHE_TTL_MS) {
    return await getLocal('courseColors');
  }
  const res = await fetch('/api/v1/users/self/colors', { credentials: 'include' });
  if (!res.ok) return await getLocal('courseColors');
  const data = (await res.json()) as CourseColors;
  await setLocal('courseColors', data.custom_colors);
  await setLocal('courseColorsFetchedAt', Date.now());
  return data.custom_colors;
}

export async function markComplete(item: PlannerItem): Promise<void> {
  await canvasPost('/api/v1/planner/overrides', {
    plannable_type: item.plannable_type,
    plannable_id: item.plannable_id,
    marked_complete: true
  });
}
