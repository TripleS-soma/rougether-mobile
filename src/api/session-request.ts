import { getSessionUserId, onSessionCleared, refreshSession } from '@/api/auth';
import { ApiError } from '@/api/http';

/** 비공개 요청은 시작한 로그인 세션에서만 재시도하고 응답을 수락한다. */
export async function inAuthenticatedSession<T>(
  request: (assertCurrent: () => void) => Promise<T>,
  changedMessage = 'Session changed',
): Promise<T> {
  const owner = getSessionUserId();
  let cleared = false;
  const unsubscribe = onSessionCleared(() => {
    cleared = true;
  });
  const assertCurrent = () => {
    if (cleared || owner == null || getSessionUserId() !== owner) throw new Error(changedMessage);
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
