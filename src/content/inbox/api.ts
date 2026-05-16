import { fetchAllPages, fetchWithRetry, canvasPost, CanvasApiError } from '../../lib/canvas-api';
import type { ConversationListItem, ConversationFull, CourseLite, RecipientSearchResult } from '../../lib/types';

async function jsonGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithRetry(url, { signal });
  if (!res.ok) throw new CanvasApiError(`${res.status} on ${url}`, res.status);
  return res.json();
}

export function fetchConversations(scope: string, signal?: AbortSignal): Promise<ConversationListItem[]> {
  const params = new URLSearchParams();
  params.set('per_page', '50');
  if (scope === 'inbox') {/* default */}
  else if (scope === 'unread') params.set('scope', 'unread');
  else if (scope === 'starred') params.set('scope', 'starred');
  else if (scope === 'sent') params.set('scope', 'sent');
  else if (scope === 'archived') params.set('scope', 'archived');
  params.set('include_all_conversation_ids', 'false');
  params.append('include[]', 'participant_avatars');
  return fetchAllPages<ConversationListItem>(`/api/v1/conversations?${params.toString()}`, { signal });
}

export function fetchConversation(id: number, signal?: AbortSignal): Promise<ConversationFull> {
  return jsonGet<ConversationFull>(`/api/v1/conversations/${id}?include[]=participant_avatars`, signal);
}

export function addMessage(id: number, body: string, recipients: Array<string | number>, signal?: AbortSignal): Promise<ConversationFull> {
  return canvasPost<ConversationFull>(
    `/api/v1/conversations/${id}/add_message`,
    { body, recipients },
    { signal }
  );
}

export function createConversation(
  recipients: Array<string | number>,
  body: string,
  subject?: string,
  contextCode?: string,
  signal?: AbortSignal
): Promise<unknown> {
  const payload: Record<string, unknown> = { recipients, body };
  if (subject) payload.subject = subject;
  if (contextCode) payload.context_code = contextCode;
  return canvasPost(`/api/v1/conversations`, payload, { signal });
}

export async function updateConversation(id: number, fields: Record<string, string | boolean>, signal?: AbortSignal): Promise<void> {
  const csrf = document.cookie.split(';').find(c => c.trim().startsWith('_csrf_token='));
  const token = csrf ? decodeURIComponent(csrf.split('=').slice(1).join('=').trim()) : null;
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) body.set(`conversation[${k}]`, String(v));
  const res = await fetch(`/api/v1/conversations/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      ...(token ? { 'X-CSRF-Token': token } : {})
    },
    body: body.toString(),
    signal
  });
  if (!res.ok && res.status !== 204) throw new CanvasApiError(`${res.status} on PUT conversation`, res.status);
}

export function fetchCourses(signal?: AbortSignal): Promise<CourseLite[]> {
  return fetchAllPages<CourseLite>(`/api/v1/courses?enrollment_state=active&per_page=100`, { signal });
}

export function searchRecipients(query: string, contextCode?: string, signal?: AbortSignal): Promise<RecipientSearchResult[]> {
  const params = new URLSearchParams();
  params.set('search', query);
  params.set('per_page', '20');
  params.set('type', 'user');
  if (contextCode) params.set('context', contextCode);
  return jsonGet<RecipientSearchResult[]>(`/api/v1/search/recipients?${params.toString()}`, signal);
}
