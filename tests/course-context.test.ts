import { describe, it, expect } from 'vitest';
import { parseCourseFromUrl } from '../src/lib/course-context';

describe('parseCourseFromUrl', () => {
  it('extracts course id from /courses/:id', () => {
    expect(parseCourseFromUrl('https://canvas.example.com/courses/1234')).toBe(1234);
  });
  it('extracts course id from /courses/:id/files', () => {
    expect(parseCourseFromUrl('https://canvas.example.com/courses/1234/files')).toBe(1234);
  });
  it('extracts course id from /courses/:id/modules?foo=1', () => {
    expect(parseCourseFromUrl('https://canvas.example.com/courses/567/modules?foo=1')).toBe(567);
  });
  it('returns null when no course in URL', () => {
    expect(parseCourseFromUrl('https://canvas.example.com/profile')).toBeNull();
  });
  it('returns null for non-numeric course segment', () => {
    expect(parseCourseFromUrl('https://canvas.example.com/courses/abc')).toBeNull();
  });
});

import { isFilesPage, isModulesPage } from '../src/lib/course-context';

describe('isFilesPage', () => {
  it('matches /courses/:id/files and subpaths', () => {
    expect(isFilesPage('https://x/courses/1/files')).toBe(true);
    expect(isFilesPage('https://x/courses/1/files/folder/Lectures')).toBe(true);
    expect(isFilesPage('https://x/courses/1/modules')).toBe(false);
  });
});

describe('isModulesPage', () => {
  it('matches /courses/:id/modules and subpaths', () => {
    expect(isModulesPage('https://x/courses/1/modules')).toBe(true);
    expect(isModulesPage('https://x/courses/1/modules?include=items')).toBe(true);
    expect(isModulesPage('https://x/courses/1/files')).toBe(false);
  });
});
