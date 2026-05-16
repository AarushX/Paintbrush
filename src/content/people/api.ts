import { fetchAllPages } from '../../lib/canvas-api';
import type { CanvasUser, Section } from '../../lib/types';

export function fetchPeople(courseId: number, signal?: AbortSignal): Promise<CanvasUser[]> {
  return fetchAllPages<CanvasUser>(
    `/api/v1/courses/${courseId}/users?include[]=enrollments&include[]=email&include[]=avatar_url&include[]=bio&per_page=100`,
    { signal }
  );
}

export function fetchSections(courseId: number, signal?: AbortSignal): Promise<Section[]> {
  return fetchAllPages<Section>(`/api/v1/courses/${courseId}/sections?per_page=100`, { signal });
}
