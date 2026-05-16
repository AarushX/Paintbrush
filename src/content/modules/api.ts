import { fetchAllPages } from '../../lib/canvas-api';
import type { ModuleFull } from '../../lib/types';

export function fetchModulesFull(courseId: number, signal?: AbortSignal): Promise<ModuleFull[]> {
  return fetchAllPages<ModuleFull>(
    `/api/v1/courses/${courseId}/modules?include[]=items&include[]=content_details&per_page=50`,
    { signal }
  );
}
