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
