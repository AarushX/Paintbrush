import { fetchAllPages } from '../../lib/canvas-api';
import type { QuizFull } from '../../lib/types';

export function fetchQuizzes(courseId: number, signal?: AbortSignal): Promise<QuizFull[]> {
  return fetchAllPages<QuizFull>(`/api/v1/courses/${courseId}/quizzes?per_page=50`, { signal });
}
