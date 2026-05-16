import type { PlannerItem } from '../../lib/types';
import { fetchPlannerItems, getCachedPlannerItems, setCachedPlannerItems, getCourseColors } from './api';
import { groupByDueWindow, filterByType, type ItemTypeFilter } from './grouping';

export const sidebarState = $state({
  items: [] as PlannerItem[],
  colors: {} as Record<string, string>,
  loading: false,
  error: null as string | null,
  filter: 'all' as ItemTypeFilter,
  lastSyncedAt: 0,
  open: true
});

export async function loadInitial() {
  const cached = await getCachedPlannerItems();
  if (cached) {
    sidebarState.items = cached;
    sidebarState.lastSyncedAt = Date.now();
  }
  sidebarState.colors = await getCourseColors().catch(() => ({}));
  await refresh();
}

export async function refresh() {
  sidebarState.loading = true;
  sidebarState.error = null;
  try {
    const items = await fetchPlannerItems();
    sidebarState.items = items;
    sidebarState.lastSyncedAt = Date.now();
    await setCachedPlannerItems(items);
  } catch (err) {
    sidebarState.error = err instanceof Error ? err.message : String(err);
  } finally {
    sidebarState.loading = false;
  }
}

export function groupedView() {
  const filtered = filterByType(sidebarState.items, sidebarState.filter);
  return groupByDueWindow(filtered);
}
