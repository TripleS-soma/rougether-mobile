import { inAuthenticatedSession } from '@/api/session-request';

/** 사진/메시지는 선택한 로그인 세션에만 속한다. */
export function inChatSession<T>(request: (assertCurrent: () => void) => Promise<T>): Promise<T> {
  return inAuthenticatedSession(request, 'Chat session changed');
}
