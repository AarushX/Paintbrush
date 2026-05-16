import type { PlannerItem } from '../../lib/types';

export interface GroupedItems {
  overdue: PlannerItem[];
  today: PlannerItem[];
  tomorrow: PlannerItem[];
  thisWeek: PlannerItem[];
  later: PlannerItem[];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function groupByDueWindow(items: PlannerItem[], now: Date = new Date()): GroupedItems {
  const out: GroupedItems = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [] };
  for (const it of items) {
    const due = new Date(it.plannable_date);
    const isComplete = !!it.planner_override?.marked_complete;
    const diff = daysBetween(now, due);
    if (due < now && diff < 0 && !isComplete) {
      out.overdue.push(it);
    } else if (diff === 0) {
      out.today.push(it);
    } else if (diff === 1) {
      out.tomorrow.push(it);
    } else if (diff >= 2 && diff <= 7) {
      out.thisWeek.push(it);
    } else if (diff > 7) {
      out.later.push(it);
    }
  }
  const sortAsc = (a: PlannerItem, b: PlannerItem) =>
    new Date(a.plannable_date).getTime() - new Date(b.plannable_date).getTime();
  out.overdue.sort(sortAsc);
  out.today.sort(sortAsc);
  out.tomorrow.sort(sortAsc);
  out.thisWeek.sort(sortAsc);
  out.later.sort(sortAsc);
  return out;
}

export type ItemTypeFilter = 'all' | 'assignment' | 'quiz' | 'discussion_topic' | 'planner_note';

export function filterByType(items: PlannerItem[], filter: ItemTypeFilter): PlannerItem[] {
  if (filter === 'all') return items;
  return items.filter((i) => i.plannable_type === filter);
}
