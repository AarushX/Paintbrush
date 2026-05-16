import type { DiscussionTopicFull, DiscussionViewFull, DiscussionEntryFull, DiscussionParticipant } from '../../lib/types';
import { fetchTopic, fetchView, postEntry, postReply, markEntryRead } from './api';

export const discussionState = $state({
  courseId: 0,
  topicId: 0,
  topic: null as DiscussionTopicFull | null,
  entries: [] as DiscussionEntryFull[],
  participants: new Map<number, DiscussionParticipant>(),
  unread: new Set<number>(),
  loading: true,
  error: null as string | null,
  search: '',
  collapsedIds: new Set<number>(),
  replyOpenFor: null as number | null, // entry id being replied to, or 0 for top-level
  posting: false
});

export async function loadDiscussion(courseId: number, topicId: number) {
  discussionState.courseId = courseId;
  discussionState.topicId = topicId;
  discussionState.loading = true;
  discussionState.error = null;
  try {
    const [topic, view] = await Promise.all([
      fetchTopic(courseId, topicId),
      fetchView(courseId, topicId)
    ]);
    discussionState.topic = topic;
    discussionState.entries = view.view ?? [];
    discussionState.participants = new Map(view.participants.map(p => [p.id, p]));
    discussionState.unread = new Set(view.unread_entries ?? []);
  } catch (err) {
    discussionState.error = err instanceof Error ? err.message : String(err);
  } finally {
    discussionState.loading = false;
  }
}

export function toggleCollapsed(id: number) {
  if (discussionState.collapsedIds.has(id)) {
    discussionState.collapsedIds.delete(id);
  } else {
    discussionState.collapsedIds.add(id);
  }
  // force reactivity
  discussionState.collapsedIds = new Set(discussionState.collapsedIds);
}

export function openReply(entryId: number | 0) {
  discussionState.replyOpenFor = entryId;
}

export function closeReply() {
  discussionState.replyOpenFor = null;
}

export async function submitTopLevel(message: string) {
  if (!message.trim()) return;
  discussionState.posting = true;
  try {
    const created = await postEntry(discussionState.courseId, discussionState.topicId, message);
    discussionState.entries = [...discussionState.entries, created];
    closeReply();
  } catch (err) {
    discussionState.error = err instanceof Error ? err.message : String(err);
  } finally {
    discussionState.posting = false;
  }
}

export async function submitReply(parentId: number, message: string) {
  if (!message.trim()) return;
  discussionState.posting = true;
  try {
    const created = await postReply(discussionState.courseId, discussionState.topicId, parentId, message);
    // Insert into the tree at the right parent
    const insert = (list: DiscussionEntryFull[]): boolean => {
      for (const e of list) {
        if (e.id === parentId) {
          e.replies = [...(e.replies ?? []), created];
          return true;
        }
        if (e.replies && insert(e.replies)) return true;
      }
      return false;
    };
    insert(discussionState.entries);
    // Force reactivity by reassigning
    discussionState.entries = [...discussionState.entries];
    closeReply();
  } catch (err) {
    discussionState.error = err instanceof Error ? err.message : String(err);
  } finally {
    discussionState.posting = false;
  }
}

export function markRead(entryId: number) {
  if (!discussionState.unread.has(entryId)) return;
  discussionState.unread.delete(entryId);
  discussionState.unread = new Set(discussionState.unread);
  markEntryRead(discussionState.courseId, discussionState.topicId, entryId).catch(() => {});
}

// Recursively counts entries (and replies) — used for the header counter.
export function countAll(entries: DiscussionEntryFull[]): number {
  let n = 0;
  for (const e of entries) {
    n += 1 + countAll(e.replies ?? []);
  }
  return n;
}

// Filter entries by search query — also filters subtree but keeps an entry
// if any descendant matches.
export function filterTree(entries: DiscussionEntryFull[], q: string, participants: Map<number, DiscussionParticipant>): DiscussionEntryFull[] {
  if (!q.trim()) return entries;
  const needle = q.toLowerCase();
  const matches = (e: DiscussionEntryFull): boolean => {
    const name = participants.get(e.user_id)?.display_name.toLowerCase() ?? '';
    if (name.includes(needle)) return true;
    const text = (e.message ?? '').replace(/<[^>]+>/g, ' ').toLowerCase();
    return text.includes(needle);
  };
  const walk = (list: DiscussionEntryFull[]): DiscussionEntryFull[] => {
    const out: DiscussionEntryFull[] = [];
    for (const e of list) {
      const subs = walk(e.replies ?? []);
      if (matches(e) || subs.length > 0) {
        out.push({ ...e, replies: subs });
      }
    }
    return out;
  };
  return walk(entries);
}
