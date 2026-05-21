import { fetchAllPages } from '../../lib/canvas-api';

export interface Collaboration {
  id: number;
  collaboration_type?: string;
  type?: string;
  title?: string;
  description?: string;
  url?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: number;
  user_name?: string;
}

export function fetchCollaborations(courseId: number, signal?: AbortSignal): Promise<Collaboration[]> {
  return fetchAllPages<Collaboration>(
    `/api/v1/courses/${courseId}/collaborations?per_page=50`,
    { signal }
  );
}
