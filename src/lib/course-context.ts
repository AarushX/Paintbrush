export function parseCourseFromUrl(url: string): number | null {
  const m = url.match(/\/courses\/(\d+)(?:\/|\?|$)/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}

export function isFilesPage(url: string): boolean {
  return /\/courses\/\d+\/files(\b|\/|\?)/.test(url);
}

export function isModulesPage(url: string): boolean {
  return /\/courses\/\d+\/modules(\b|\/|\?)/.test(url);
}

export function isCourseRootPage(url: string): boolean {
  // Matches /courses/:id and /courses/:id/ (and with trailing query),
  // but not /courses/:id/files, /modules, etc. — those are caught earlier.
  return /\/courses\/\d+\/?(\?|$)/.test(url);
}

export function parseDiscussionFromUrl(url: string): { courseId: number; topicId: number } | null {
  const m = url.match(/\/courses\/(\d+)\/discussion_topics\/(\d+)(?:\/|\?|$)/);
  if (!m) return null;
  return { courseId: Number(m[1]), topicId: Number(m[2]) };
}

export function isDiscussionPage(url: string): boolean {
  return parseDiscussionFromUrl(url) !== null;
}
