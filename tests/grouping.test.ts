import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { groupByDueWindow } from '../src/content/sidebar/grouping';
import type { PlannerItem } from '../src/lib/types';

function item(plannable_date: string, marked_complete = false): PlannerItem {
  return {
    plannable_id: 1,
    plannable_type: 'assignment',
    plannable_date,
    plannable: { title: 'X' },
    course_id: 1,
    context_name: 'Course',
    html_url: '/x',
    planner_override: marked_complete ? { id: 1, marked_complete: true } : null
  };
}

describe('groupByDueWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('puts past-due items in overdue', () => {
    const items = [item('2026-05-14T23:59:00Z')];
    expect(groupByDueWindow(items).overdue).toHaveLength(1);
  });

  it('puts today items in today', () => {
    const items = [item('2026-05-15T23:59:00Z')];
    expect(groupByDueWindow(items).today).toHaveLength(1);
  });

  it('puts tomorrow items in tomorrow', () => {
    const items = [item('2026-05-16T10:00:00Z')];
    expect(groupByDueWindow(items).tomorrow).toHaveLength(1);
  });

  it('puts items 2-7 days out in thisWeek', () => {
    const items = [item('2026-05-18T10:00:00Z'), item('2026-05-22T10:00:00Z')];
    expect(groupByDueWindow(items).thisWeek).toHaveLength(2);
  });

  it('puts items beyond 7 days in later', () => {
    const items = [item('2026-05-25T10:00:00Z')];
    expect(groupByDueWindow(items).later).toHaveLength(1);
  });

  it('excludes completed items from overdue', () => {
    const items = [item('2026-05-14T23:59:00Z', true)];
    expect(groupByDueWindow(items).overdue).toHaveLength(0);
  });

  it('sorts each group ascending by due date', () => {
    const items = [
      item('2026-05-18T22:00:00Z'),
      item('2026-05-17T10:00:00Z')
    ];
    const result = groupByDueWindow(items);
    expect(result.thisWeek[0]?.plannable_date).toBe('2026-05-17T10:00:00Z');
  });
});
