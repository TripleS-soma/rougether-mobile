import { clearChatImageFiles, loadChatImageFile } from '@/lib/chat-image-files.native';
import * as FileSystem from 'expo-file-system/legacy';

const mockFiles = new Map<string, { size: number; modified: number; directory?: boolean }>();
jest.mock('@/api/config', () => ({ API_BASE: 'https://api.test/api/v1' }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(async (uri: string) => {
    mockFiles.set(uri, { size: 0, modified: 0, directory: true });
  }),
  readDirectoryAsync: jest.fn(async (uri: string) => [
    ...new Set(
      [...mockFiles.keys()]
        .filter((key) => key.startsWith(uri) && key !== uri)
        .map((key) => key.slice(uri.length).split('/')[0])
        .filter(Boolean),
    ),
  ]),
  getInfoAsync: jest.fn(async (uri: string) => {
    const file = mockFiles.get(uri) ?? mockFiles.get(`${uri}/`);
    return file
      ? {
          exists: true,
          isDirectory: !!file.directory,
          size: file.size,
          modificationTime: file.modified,
        }
      : { exists: false };
  }),
  deleteAsync: jest.fn(async (uri: string) => {
    for (const key of mockFiles.keys())
      if (key === uri || key.startsWith(uri.endsWith('/') ? uri : `${uri}/`)) mockFiles.delete(key);
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const info = mockFiles.get(from);
    if (!info) throw new Error('missing download');
    mockFiles.set(to, info);
    mockFiles.delete(from);
  }),
  downloadAsync: jest.fn(async (_url: string, uri: string) => {
    const directory = uri.slice(0, uri.lastIndexOf('/') + 1);
    if (!mockFiles.has(directory)) throw new Error('missing parent directory');
    mockFiles.set(uri, { size: 1024, modified: Date.now() / 1000 });
    return { uri, status: 200, headers: { 'content-type': 'image/jpeg' } };
  }),
}));
const expiry = () => new Date(Date.now() + 86400000).toISOString();
const load = (id: number, user = 1, check = () => {}) =>
  loadChatImageFile(user, id, expiry(), 'https://api.test/photo', 'private-token', check);
beforeEach(async () => {
  await clearChatImageFiles();
  mockFiles.clear();
  jest.clearAllMocks();
});

it('재진입과 모듈 재시작 후에도 저장된 파일을 재사용해 다운로드하지 않는다', async () => {
  const until = expiry();
  const first = await loadChatImageFile(
    1,
    10,
    until,
    'https://api.test/photo',
    'private-token',
    () => {},
  );
  const second = await loadChatImageFile(
    1,
    10,
    until,
    'https://api.test/photo',
    'private-token',
    () => {},
  );
  let restarted!: typeof import('@/lib/chat-image-files.native');
  jest.isolateModules(() => {
    // Jest's isolated CommonJS registry simulates a fresh app process.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    restarted = require('@/lib/chat-image-files.native');
  });
  expect(
    await restarted.loadChatImageFile(
      1,
      10,
      until,
      'https://api.test/photo',
      'private-token',
      () => {},
    ),
  ).toBe(first);
  expect(second).toBe(first);
  expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(1);
  expect(first).not.toContain('private-token');
});

it('만료 사진과 중단된 임시 파일을 다음 접근에서 정리한다', async () => {
  const path = (await load(1))!;
  const directory = path.slice(0, path.lastIndexOf('/') + 1);
  mockFiles.set(`${directory}2-1.jpg`, { size: 100, modified: 1 });
  mockFiles.set(`${directory}abandoned.part`, { size: 100, modified: 1 });
  await load(3);
  expect(mockFiles.has(`${directory}2-1.jpg`)).toBe(false);
  expect(mockFiles.has(`${directory}abandoned.part`)).toBe(false);
  expect(await loadChatImageFile(1, 4, new Date(0).toISOString(), '', '', () => {})).toBeNull();
  expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(2);
});

it('128MB를 넘으면 오래된 파일부터 제거한다', async () => {
  const path = (await load(1))!;
  const directory = path.slice(0, path.lastIndexOf('/') + 1);
  const until = Date.now() + 86400000;
  mockFiles.set(`${directory}2-${until}.jpg`, { size: 70 * 1024 * 1024, modified: 1 });
  mockFiles.set(`${directory}3-${until}.jpg`, { size: 70 * 1024 * 1024, modified: 2 });
  await load(4);
  expect(mockFiles.has(`${directory}2-${until}.jpg`)).toBe(false);
  const size = [...mockFiles.values()].reduce((sum, f) => sum + f.size, 0);
  expect(size).toBeLessThanOrEqual(128 * 1024 * 1024);
});

it('다른 계정은 같은 사진 ID의 파일을 재사용하지 않는다', async () => {
  const first = (await load(1, 1))!;
  const second = (await load(1, 2))!;
  expect(second).not.toBe(first);
  expect(mockFiles.has(first)).toBe(false);
  expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(2);
});

it('로그아웃 중인 다운로드는 늦게 완료돼도 파일을 남기지 않는다', async () => {
  let finish!: () => void;
  const original = jest.mocked(FileSystem.downloadAsync).getMockImplementation()!;
  jest.mocked(FileSystem.downloadAsync).mockImplementationOnce(async (...args) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return original(...args);
  });
  const pending = load(1);
  while (!finish) await new Promise((resolve) => setTimeout(resolve, 0));
  await clearChatImageFiles();
  finish();
  await expect(pending).rejects.toThrow();
  expect(
    [...mockFiles.keys()].filter((key) => key.endsWith('.jpg') || key.endsWith('.part')),
  ).toEqual([]);
});

it('OS가 캐시 폴더를 회수해도 재다운로드 전에 다시 생성한다', async () => {
  await load(10);
  mockFiles.clear();
  await expect(load(11)).resolves.toMatch(/^file:/);
  expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(2);
});

it('동시 다운로드는 두 장으로 제한하고 임시 파일 용량도 예약한다', async () => {
  const original = jest.mocked(FileSystem.downloadAsync).getMockImplementation()!;
  const finish: (() => void)[] = [];
  let active = 0;
  let peak = 0;
  jest.mocked(FileSystem.downloadAsync).mockImplementation(async (...args) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => finish.push(resolve));
    active -= 1;
    return original(...args);
  });
  try {
    const pending = [load(20), load(21), load(22), load(23)];
    while (finish.length < 2) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(2);
    finish.splice(0).forEach((done) => done());
    while (finish.length < 2) await new Promise((resolve) => setTimeout(resolve, 0));
    finish.splice(0).forEach((done) => done());
    await Promise.all(pending);
    expect(peak).toBe(2);
  } finally {
    jest.mocked(FileSystem.downloadAsync).mockImplementation(original);
  }
});
