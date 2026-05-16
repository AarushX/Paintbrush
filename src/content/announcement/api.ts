import { fetchAllPages, CanvasApiError } from '../../lib/canvas-api';
import type { Announcement } from '../../lib/types';

export function fetchAnnouncements(courseId: number, signal?: AbortSignal): Promise<Announcement[]> {
  return fetchAllPages<Announcement>(
    `/api/v1/announcements?context_codes[]=course_${courseId}&per_page=50&active_only=false&start_date=1970-01-01&end_date=${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}`,
    { signal }
  );
}
