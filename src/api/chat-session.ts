import { getSessionUserId, onSessionCleared, refreshSession } from '@/api/auth';
import { ApiError } from '@/api/http';

/** 선택한 사진/메시지는 시작한 로그인 세션에서만 재요청한다. */
export async function inChatSession<T>(
  request: (assertCurrent: () => void) => Promise<T>,
): Promise<T> {
  const owner = getSessionUserId();
  let cleared = false;
  const unsubscribe = onSessionCleared(() => {
    cleared = true;
  });
  const assertCurrent = () => {
    if (cleared || owner == null || getSessionUserId() !== owner)
      throw new Error('Chat session changed');
  };
  try {
    assertCurrent();
    let result: T;
    try {
      result = await request(assertCurrent);
    } catch (error) {
      assertCurrent();
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (!(await refreshSession())) throw error;
      assertCurrent();
      result = await request(assertCurrent);
    }
    assertCurrent();
    return result;
  } finally {
    unsubscribe();
  }
}
