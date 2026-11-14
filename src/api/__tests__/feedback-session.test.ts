import { submitSuggestion } from '@/api/feedback';
import { apiPost } from '@/api/client';
import { refreshSession } from '@/api/auth';
import { ApiError } from '@/api/http';
let mockUser = 1;
const mockListeners = new Set<() => void>();
jest.mock('@/api/client', () => ({ apiPost: jest.fn(), apiGet: jest.fn() }));
jest.mock('@/api/auth', () => ({
  getSessionUserId: () => mockUser,
  onSessionCleared: (fn: () => void) => {
    mockListeners.add(fn);
    return () => mockListeners.delete(fn);
  },
  refreshSession: jest.fn(async () => true),
}));
it('전송 중 계정이 바뀌면 다른 계정으로 건의를 재전송하지 않는다', async () => {
  let reject!: (error: unknown) => void;
  jest.mocked(apiPost).mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const pending = submitSuggestion({ title: '개인 건의', content: '비공개 내용' });
  mockListeners.forEach((fn) => fn());
  mockUser = 2;
  reject(new ApiError(401, 'POST', '/suggestions'));
  await expect(pending).rejects.toThrow('Session changed');
  expect(apiPost).toHaveBeenCalledTimes(1);
  expect(refreshSession).not.toHaveBeenCalled();
  expect(mockListeners.size).toBe(0);
});
