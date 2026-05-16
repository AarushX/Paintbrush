export interface PlannerItem {
  plannable_id: number;
  plannable_type: 'assignment' | 'quiz' | 'discussion_topic' | 'planner_note' | 'announcement' | 'wiki_page' | 'calendar_event';
  plannable_date: string; // ISO
  plannable: {
    title?: string;
    name?: string;
    points_possible?: number;
    due_at?: string | null;
  };
  course_id: number | null;
  context_name: string | null;
  html_url: string;
  planner_override?: {
    id: number;
    marked_complete: boolean;
  } | null;
}

export interface CourseColors {
  custom_colors: Record<string, string>;
}

export interface Course {
  id: number;
  name: string;
  course_code: string;
}

export interface Folder {
  id: number;
  name: string;
  full_name: string;
  parent_folder_id: number | null;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  folder_id: number;
}

export interface Module {
  id: number;
  name: string;
  position: number;
  items: ModuleItem[];
}

export interface ModuleItem {
  id: number;
  title: string;
  position: number;
  type: 'File' | 'Page' | 'Assignment' | 'Quiz' | 'Discussion' | 'ExternalUrl' | 'ExternalTool' | 'SubHeader';
  content_id?: number;
  page_url?: string;
  external_url?: string;
  html_url?: string;
}

export interface Page {
  page_id: number;
  title: string;
  url: string;
  body: string;
  updated_at: string;
  html_url: string;
}

export interface Assignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  points_possible: number;
  submission_types: string[];
  html_url: string;
}
