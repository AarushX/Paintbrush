import { fetchAllPages, fetchWithRetry, CanvasApiError } from '../../lib/canvas-api';
import type { CalendarEvent } from '../../lib/types';

async function jsonGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithRetry(url, { signal });
  if (!res.ok) throw new CanvasApiError(`${res.status} on ${url}`, res.status);
  return res.json();
}

export async function fetchEvents(
  contextCodes: string[],
  startISO: string,
  endISO: string,
  type: 'event' | 'assignment',
  signal?: AbortSignal
): Promise<CalendarEvent[]> {
  if (contextCodes.length === 0) return [];
  const params = new URLSearchParams();
  params.set('type', type);
  params.set('start_date', startISO);
  params.set('end_date', endISO);
  params.set('per_page', '100');
  for (const cc of contextCodes) params.append('context_codes[]', cc);
  return fetchAllPages<CalendarEvent>(`/api/v1/calendar_events?${params.toString()}`, { signal });
}

interface DashCard { id: number; courseCode?: string; longName?: string; shortName?: string; originalName?: string; color?: string | null }

export function fetchUserContexts(signal?: AbortSignal): Promise<DashCard[]> {
  return jsonGet<DashCard[]>('/api/v1/dashboard/dashboard_cards', signal);
}

export async function fetchSelfId(signal?: AbortSignal): Promise<number | null> {
  try {
    const me = await jsonGet<{ id: number }>('/api/v1/users/self', signal);
    return me.id;
  } catch { return null; }
}

/**
 * The user's iCal feed URL is exposed inside Canvas's /calendar page HTML.
 * We fetch the page HTML (same origin, cookie auth) and pull the URL from
 * one of the known anchors / data attributes Canvas uses for it.
 */
export async function discoverIcalUrl(): Promise<string | null> {
  try {
    const html = await fetch('/calendar', { credentials: 'include' }).then(r => r.text());
    // Canvas renders the feed URL in a few shapes; try a permissive regex.
    const m =
      html.match(/href=["'](https?:\/\/[^"']+\/feeds\/calendars\/user_[^"']+\.ics)["']/) ||
      html.match(/value=["'](https?:\/\/[^"']+\/feeds\/calendars\/user_[^"']+\.ics)["']/) ||
      html.match(/(https?:\/\/[^\s"'<>]+\/feeds\/calendars\/user_[A-Za-z0-9]+\.ics)/);
    return m ? (m[1] ?? null) : null;
  } catch {
    return null;
  }
}
