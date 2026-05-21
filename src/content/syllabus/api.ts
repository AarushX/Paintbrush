import { fetchWithRetry, fetchAllPages, CanvasApiError } from '../../lib/canvas-api';

export interface SyllabusCourse {
  id: number;
  name: string;
  course_code?: string;
  syllabus_body?: string | null;
}

export interface SyllabusAssignment {
  id: number;
  name: string;
  due_at?: string | null;
  points_possible?: number | null;
  html_url?: string;
  submission_types?: string[];
}

export async function fetchSyllabusCourse(courseId: number, signal?: AbortSignal): Promise<SyllabusCourse> {
  const res = await fetchWithRetry(`/api/v1/courses/${courseId}?include[]=syllabus_body`, { signal });
  if (!res.ok) throw new CanvasApiError(`${res.status} on course`, res.status);
  return res.json();
}

export function fetchSyllabusAssignments(courseId: number, signal?: AbortSignal): Promise<SyllabusAssignment[]> {
  return fetchAllPages<SyllabusAssignment>(
    `/api/v1/courses/${courseId}/assignments?per_page=100`,
    { signal }
  );
}
