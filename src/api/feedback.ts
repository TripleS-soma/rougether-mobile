import { apiGet, apiPost } from '@/api/client';
import { inAuthenticatedSession } from '@/api/session-request';

export type FeedbackEntry = { id: number; title: string; content: string; createdAt: string };
export type FeedbackPage = { items: FeedbackEntry[]; nextCursor: number | null };
export type SuggestionInput = { title: string; content: string };

export function fetchSuggestions(cursor: number | null): Promise<FeedbackPage> {
  return inAuthenticatedSession(() =>
    apiGet(`/me/suggestions${cursor === null ? '' : `?cursor=${cursor}`}`, {
      refreshOnUnauthorized: false,
    }),
  );
}
export function fetchUpdates(cursor: number | null): Promise<FeedbackPage> {
  return apiGet(`/updates${cursor === null ? '' : `?cursor=${cursor}`}`);
}
export function submitSuggestion(input: SuggestionInput): Promise<FeedbackEntry> {
  return inAuthenticatedSession(() =>
    apiPost('/suggestions', input, { refreshOnUnauthorized: false }),
  );
}
