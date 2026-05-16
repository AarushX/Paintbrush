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

export interface Submission {
  id: number;
  workflow_state: 'submitted' | 'graded' | 'unsubmitted' | 'pending_review' | string;
  score: number | null;
  grade: string | null;
  submitted_at: string | null;
  late: boolean;
  missing: boolean;
  excused: boolean;
  attempt: number | null;
  preview_url?: string;
}

// === dashboard additions ===

export interface DashboardCard {
  id: number;
  longName: string;
  shortName: string;
  originalName: string;
  courseCode: string;
  assetString?: string;
  href: string;
  term?: string;
  subtitle?: string;
  enrollmentState?: string;
  image?: string | null;
  color?: string | null;
  position?: number | null;
  isFavorited?: boolean;
  isK5Subject?: boolean;
  isHomeroom?: boolean;
  canManage?: boolean;
  canChangeCourseState?: boolean;
  defaultView?: string;
  pagesUrl?: string;
  frontPageTitle?: string | null;
  links?: Array<{
    css_class: string;
    hidden?: boolean | null;
    icon: string;
    label: string;
    path: string;
  }>;
}

export interface CanvasUserSelf {
  id: number;
  name: string;
  short_name?: string;
  sortable_name?: string;
  avatar_url?: string;
  primary_email?: string;
  effective_locale?: string;
  time_zone?: string;
}

export interface CourseWithScore {
  id: number;
  name: string;
  course_code: string;
  enrollments?: Array<{
    type: string;
    computed_current_score?: number | null;
    computed_current_grade?: string | null;
  }>;
  image_download_url?: string | null;
}

export interface AssignmentFull extends Assignment {
  course_id?: number;
  has_submitted_submissions?: boolean;
  submission?: Submission;
  unlock_at?: string | null;
  lock_at?: string | null;
  allowed_extensions?: string[];
  is_quiz_assignment?: boolean;
  locked_for_user?: boolean;
}

export interface AssignmentListItem {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number;
  html_url: string;
  submission_types: string[];
  has_submitted_submissions: boolean;
  submission?: Submission;
  position?: number;
  assignment_group_id?: number;
}

export interface AssignmentGroup {
  id: number;
  name: string;
  position: number;
  assignments?: AssignmentListItem[];
}

// === modules/people additions ===

export interface ModuleItemFull {
  id: number;
  title: string;
  position: number;
  indent?: number;
  type: 'File' | 'Page' | 'Assignment' | 'Quiz' | 'Discussion' | 'ExternalUrl' | 'ExternalTool' | 'SubHeader';
  content_id?: number;
  page_url?: string;
  external_url?: string;
  html_url?: string;
  completion_requirement?: { type: string; min_score?: number; completed?: boolean };
  content_details?: {
    points_possible?: number;
    due_at?: string;
    locked_for_user?: boolean;
    lock_explanation?: string;
  };
}

export interface ModuleFull {
  id: number;
  name: string;
  position: number;
  state?: 'locked' | 'unlocked' | 'started' | 'completed';
  completed_at?: string | null;
  prerequisite_module_ids?: number[];
  items?: ModuleItemFull[];
  items_count?: number;
}

export interface CanvasUser {
  id: number;
  name: string;
  short_name?: string;
  sortable_name?: string;
  avatar_url?: string;
  email?: string;
  bio?: string;
  pronouns?: string;
  enrollments?: Array<{
    id: number;
    type: 'StudentEnrollment' | 'TeacherEnrollment' | 'TaEnrollment' | 'DesignerEnrollment' | 'ObserverEnrollment' | string;
    role?: string;
    role_id?: number;
    enrollment_state?: 'active' | 'invited' | 'inactive' | string;
    last_activity_at?: string | null;
    section_id?: number;
    course_section_id?: number;
  }>;
}

export interface Section {
  id: number;
  name: string;
}

// === grades/home additions ===

export interface EnrollmentScore {
  id: number;
  user_id: number;
  type: string;
  course_id?: number;
  enrollment_state?: string;
  computed_current_score?: number | null;
  computed_current_grade?: string | null;
  computed_final_score?: number | null;
  computed_final_grade?: string | null;
  current_period_computed_current_score?: number | null;
  current_period_computed_current_grade?: string | null;
}

export interface AssignmentGroupWithScores {
  id: number;
  name: string;
  position: number;
  group_weight?: number;
  assignments?: AssignmentListItem[];
}

export interface CourseWithMeta {
  id: number;
  name: string;
  course_code: string;
  term?: { id: number; name: string };
  enrollments?: Array<{
    type: string;
    computed_current_score?: number | null;
    computed_current_grade?: string | null;
    computed_final_score?: number | null;
    computed_final_grade?: string | null;
  }>;
  syllabus_body?: string | null;
  apply_assignment_group_weights?: boolean;
  image_download_url?: string | null;
}

// === calendar additions ===

export interface CalendarEvent {
  id: number | string;
  title: string;
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  description?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  context_code: string; // "course_123" or "user_456"
  context_name?: string;
  workflow_state?: string;
  url?: string;
  html_url?: string;
  type?: 'event' | 'assignment';
  assignment?: {
    id: number;
    name: string;
    points_possible: number | null;
    due_at: string | null;
    html_url: string;
  };
}

// === inbox additions ===

export interface ConversationListItem {
  id: number;
  subject: string;
  workflow_state: 'read' | 'unread' | 'archived' | string;
  last_message?: string;
  last_message_at?: string;
  last_authored_message_at?: string;
  message_count: number;
  subscribed?: boolean;
  private?: boolean;
  starred?: boolean;
  properties?: string[];
  participants?: Array<{
    id: number;
    name: string;
    full_name?: string;
    avatar_url?: string;
  }>;
  audience?: number[];
  audience_contexts?: { courses?: Record<string, string[]>; groups?: Record<string, string[]> };
  context_code?: string;
  context_name?: string;
  avatar_url?: string;
  visible?: boolean;
}

export interface ConversationMessage {
  id: number;
  author_id: number;
  created_at: string;
  body: string;
  generated?: boolean;
  attachments?: Array<{ id: number; display_name: string; url: string }>;
  forwarded_messages?: ConversationMessage[];
}

export interface ConversationFull extends ConversationListItem {
  messages: ConversationMessage[];
  submissions?: unknown[];
}

export interface CourseLite {
  id: number;
  name: string;
  course_code: string;
}

export interface RecipientSearchResult {
  id: string | number;
  name: string;
  avatar_url?: string;
  type?: 'user' | 'context';
  common_courses?: Record<string, string[]>;
}
