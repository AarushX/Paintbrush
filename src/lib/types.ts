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

export interface Announcement {
  id: number;
  title: string;
  message: string; // HTML
  posted_at: string;
  author?: { display_name?: string };
  html_url: string;
}

export interface DiscussionTopic {
  id: number;
  title: string;
  message: string; // HTML
  posted_at: string;
  author?: { display_name?: string };
  discussion_subentry_count?: number;
  html_url: string;
}

export interface DiscussionView {
  view: DiscussionEntry[];
  participants: Array<{ id: number; display_name: string }>;
}

export interface DiscussionEntry {
  id: number;
  user_id: number;
  created_at: string;
  message: string; // HTML
  replies?: DiscussionEntry[];
}

export interface Quiz {
  id: number;
  title: string;
  description: string | null; // HTML
  due_at: string | null;
  points_possible: number | null;
  html_url: string;
}

export interface CourseWithSyllabus extends Course {
  syllabus_body?: string | null;
  default_view?: string;
}

// Augment the existing DiscussionTopic
export interface DiscussionTopicFull extends DiscussionTopic {
  require_initial_post?: boolean;
  user_can_see_posts?: boolean;
  locked?: boolean;
  locked_for_user?: boolean;
}

// Augment DiscussionEntry with the fields the /view endpoint returns
export interface DiscussionEntryFull {
  id: number;
  user_id: number;
  parent_id: number | null;
  created_at: string;
  updated_at?: string;
  message: string; // HTML
  rating_sum?: number;
  rating_count?: number;
  deleted?: boolean;
  editor_id?: number;
  replies?: DiscussionEntryFull[];
}

export interface DiscussionParticipant {
  id: number;
  display_name: string;
  avatar_image_url?: string;
  html_url?: string;
}

export interface DiscussionViewFull {
  unread_entries: number[];
  forced_entries?: number[];
  participants: DiscussionParticipant[];
  view: DiscussionEntryFull[];
  new_entries?: DiscussionEntryFull[];
}
