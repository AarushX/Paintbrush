import { fetchAllPages } from '../../lib/canvas-api';
import type { DiscussionTopic } from '../../lib/types';

export function fetchDiscussions(courseId: number, signal?: AbortSignal): Promise<DiscussionTopic[]> {
  return fetchAllPages<DiscussionTopic>(
    `/api/v1/courses/${courseId}/discussion_topics?per_page=50&exclude_assignment_descriptions=true`,
    { signal }
  );
}
