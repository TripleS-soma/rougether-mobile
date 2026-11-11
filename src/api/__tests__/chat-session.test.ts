import { inChatSession } from '@/api/chat-session';
import { ApiError } from '@/api/http';
import { refreshSession } from '@/api/auth';

let mockUser: number | undefined = 1;
const mockListeners = new Set<() => void>();
jest.mock('@/api/auth', () => ({
  getSessionUserId: () => mockUser,
  onSessionCleared: (fn: () => void) => {
    mockListeners.add(fn);
    return () => mockListeners.delete(fn);
  },
  refreshSession: jest.fn(async () => true),
}));
beforeEach(() => {
  mockUser = 1;
  mockListeners.clear();
  jest.clearAllMocks();
});
const unauthorized = () => new ApiError(401, 'POST', '/chat/rooms/1/images');

it('같은 세션의 만료 토큰만 한 번 갱신해 재시도한다', async () => {
  const request = jest
    .fn()
    .mockRejectedValueOnce(unauthorized())
    .mockResolvedValueOnce({ imageId: 1 });
  await expect(inChatSession(request)).resolves.toEqual({ imageId: 1 });
  expect(request).toHaveBeenCalledTimes(2);
  expect(refreshSession).toHaveBeenCalledTimes(1);
});
it('A 업로드가 401인 동안 B로 로그인하면 갱신·사진 재전송을 하지 않는다', async () => {
  let reject!: (error: unknown) => void;
  const request = jest.fn(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const pending = inChatSession(request);
  mockListeners.forEach((fn) => fn());
  mockUser = 2;
  reject(unauthorized());
  await expect(pending).rejects.toThrow('Chat session changed');
  expect(request).toHaveBeenCalledTimes(1);
  expect(refreshSession).not.toHaveBeenCalled();
});
it('같은 회원으로 재로그인해도 이전 업로드 응답을 폐기한다', async () => {
  let resolve!: (result: unknown) => void;
  const pending = inChatSession(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  mockListeners.forEach((fn) => fn());
  resolve({ imageId: 1 });
  await expect(pending).rejects.toThrow('Chat session changed');
  expect(mockListeners.size).toBe(0);
});
