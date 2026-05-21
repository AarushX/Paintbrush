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

export function parseAssignmentFromUrl(url: string): { courseId: number; assignmentId: number } | null {
  const m = url.match(/\/courses\/(\d+)\/assignments\/(\d+)(?:\/|\?|$)/);
  if (!m) return null;
  return { courseId: Number(m[1]), assignmentId: Number(m[2]) };
}

export function isAssignmentDetailPage(url: string): boolean {
  return parseAssignmentFromUrl(url) !== null;
}

export function isAssignmentListPage(url: string): boolean {
  // /courses/:id/assignments or /courses/:id/assignments/ (no further segment)
  return /\/courses\/\d+\/assignments\/?(\?|$)/.test(url);
}

export function isAnnouncementsListPage(url: string): boolean {
  return /\/courses\/\d+\/announcements\/?(\?|$)/.test(url);
}

// === modules/people additions ===

export function isModulesListPage(url: string): boolean {
  return /\/courses\/\d+\/modules\/?(\?|$)/.test(url);
}

export function isPeoplePage(url: string): boolean {
  // Canvas uses /users for the people page
  return /\/courses\/\d+\/users\/?(\?|$)/.test(url);
}

// === grades/home additions ===

export function isGradesPage(url: string): boolean {
  return /\/courses\/\d+\/grades\/?(\?|$)/.test(url);
}

export function isCourseHomePage(url: string): boolean {
  // Strictly the root /courses/:id (or /courses/:id/) — no further path segment
  return /\/courses\/\d+\/?(\?|$)/.test(url) && !/\/courses\/\d+\/[a-z]/.test(url);
}

// === discussions-list/modules-fix additions ===

export function isDiscussionsListPage(url: string): boolean {
  // Matches /courses/:id/discussion_topics or /courses/:id/discussion_topics/
  // but NOT /courses/:id/discussion_topics/123 (that's the detail page).
  return /\/courses\/\d+\/discussion_topics\/?(\?|$)/.test(url);
}

// === dashboard additions ===

export function isDashboardPage(url: string): boolean {
  // Strictly the Canvas root: "/" with optional query, nothing else
  try {
    const u = new URL(url);
    return u.pathname === '/' || u.pathname === '';
  } catch {
    return false;
  }
}

// === calendar additions ===

export function isCalendarPage(url: string): boolean {
  // /calendar or /calendar2 with optional query
  return /\/calendar2?\/?(\?|$)/.test(new URL(url).pathname);
}

// === inbox additions ===

export function isInboxPage(url: string): boolean {
  try {
    return /\/conversations\/?(\?|$|#)/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

// === files-viewer additions ===

export function parseFilesFolderPath(url: string): { courseId: number; folderPath: string } | null {
  try {
    const m = new URL(url).pathname.match(/\/courses\/(\d+)\/files(?:\/folder\/(.*))?\/?$/);
    if (!m) return null;
    return { courseId: Number(m[1]), folderPath: m[2] ? decodeURIComponent(m[2]) : '' };
  } catch {
    return null;
  }
}

export function parseFilePreviewUrl(url: string): { courseId: number; fileId: number } | null {
  try {
    const m = new URL(url).pathname.match(/\/courses\/(\d+)\/files\/(\d+)\/?$/);
    if (!m) return null;
    return { courseId: Number(m[1]), fileId: Number(m[2]) };
  } catch {
    return null;
  }
}

// === quizzes-viewer additions ===

export function isQuizzesListPage(url: string): boolean {
  try {
    return /\/courses\/\d+\/quizzes\/?(\?|$)/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}
