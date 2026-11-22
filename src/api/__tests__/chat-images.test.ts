import { fetchChatImage } from '@/api/chat-images';
import {
  loadChatImageFile,
  removeChatImageFile,
  clearChatImageFiles,
} from '@/lib/chat-image-files';
import { refreshSession } from '@/api/auth';

let mockUser: number | undefined = 1;
let mockToken: string | null = 'access';
const mockListeners = jest.requireMock('@/api/auth').__listeners as Set<() => void>;
jest.mock('@/api/auth', () => {
  const listeners = new Set<() => void>();
  return {
    __listeners: listeners,
    getSessionUserId: () => mockUser,
    getAccessToken: () => mockToken,
    refreshSession: jest.fn(async () => true),
    onSessionCleared: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});
jest.mock('@/api/client', () => ({ apiDelete: jest.fn(), apiUpload: jest.fn() }));
jest.mock('@/lib/chat-image-files', () => ({
  loadChatImageFile: jest.fn(async () => 'file:///cache/photo.jpg'),
  removeChatImageFile: jest.fn(async () => {}),
  clearChatImageFiles: jest.fn(async () => {}),
  sweepChatImageFiles: jest.fn(async () => {}),
}));
const metadata = () =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ imageId: 1, expiresAt: new Date(Date.now() + 60000).toISOString() }),
  }) as Response;
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = 1;
  mockToken = 'access';
  global.fetch = jest.fn(async () => metadata());
});
it('사진 바이트 대신 metadata로 권한을 확인하고 네이티브 파일을 반환한다', async () => {
  await expect(fetchChatImage(1)).resolves.toBe('file:///cache/photo.jpg');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(jest.mocked(fetch).mock.calls[0][0]).toMatch(/chat\/images\/1\/metadata$/);
  expect(loadChatImageFile).toHaveBeenCalledTimes(1);
});
it('권한이 없어졌으면 기존 파일을 지우고 캐시를 표시하지 않는다', async () => {
  jest.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response);
  await expect(fetchChatImage(2)).resolves.toBeNull();
  expect(removeChatImageFile).toHaveBeenCalledWith(1, 2);
  expect(loadChatImageFile).not.toHaveBeenCalled();
});
it('동일 사진 동시 요청은 하나로 합치지만 다음 열람은 다시 권한을 확인한다', async () => {
  await Promise.all([fetchChatImage(3), fetchChatImage(3)]);
  expect(fetch).toHaveBeenCalledTimes(1);
  await fetchChatImage(3);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('만료 사진은 디스크 파일이 있어도 읽지 않는다', async () => {
  jest.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ expiresAt: new Date(0).toISOString() }),
  } as Response);
  await expect(fetchChatImage(4)).resolves.toBeNull();
  expect(loadChatImageFile).not.toHaveBeenCalled();
  expect(removeChatImageFile).toHaveBeenCalledWith(1, 4);
});
it('동일 계정으로 재로그인해도 로그아웃 이전 응답은 폐기한다', async () => {
  let finish!: (response: Response) => void;
  jest.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = fetchChatImage(5);
  mockListeners.forEach((fn) => fn());
  finish(metadata());
  await expect(pending).rejects.toThrow('session changed');
  expect(clearChatImageFiles).toHaveBeenCalled();
  expect(loadChatImageFile).not.toHaveBeenCalled();
});
it('토큰 만료는 한 번 갱신하고 metadata를 재조회한다', async () => {
  jest.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 401 } as Response);
  await expect(fetchChatImage(6)).resolves.toBe('file:///cache/photo.jpg');
  expect(refreshSession).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(2);
});
