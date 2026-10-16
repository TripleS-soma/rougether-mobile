import {
  clearFeedImageCache,
  feedImageCacheStats,
  fetchFeedImage,
  IMAGE_CACHE_BYTES,
} from '@/api/feed';

jest.mock('@/api/auth', () => ({
  getAccessToken: () => 'token',
  onSessionCleared: () => () => {},
  refreshSession: async () => false,
}));

const realFetch = global.fetch;
const realReader = global.FileReader;
const MB = 1024 * 1024;

// 사진 id마다 원본 크기를 정해 두고, data URI는 크기를 담은 짧은 문자열로 대신한다.
function serveImages(sizes: Record<number, number>) {
  const fetchMock = jest.fn(async (url: string) => {
    const id = Number(url.split('/').pop());
    return { ok: true, status: 200, blob: async () => ({ size: sizes[id], id }) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeAll(() => {
  class FakeReader {
    result: string | null = null;
    onloadend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(blob: { id: number }) {
      this.result = `data:image/jpeg;base64,${blob.id}`;
      this.onloadend?.();
    }
  }
  global.FileReader = FakeReader as unknown as typeof FileReader;
});

afterEach(() => {
  clearFeedImageCache();
  global.fetch = realFetch;
});

afterAll(() => {
  global.FileReader = realReader;
});

it('원본 바이트 합이 예산을 넘으면 가장 오래 안 본 사진부터 버린다', async () => {
  const perImage = 3 * MB;
  const fit = IMAGE_CACHE_BYTES / perImage;
  const sizes = Object.fromEntries(Array.from({ length: fit + 1 }, (_, i) => [i + 1, perImage]));
  const fetchMock = serveImages(sizes);

  for (let id = 1; id <= fit; id++) await fetchFeedImage(id);
  expect(feedImageCacheStats()).toEqual({ count: fit, bytes: IMAGE_CACHE_BYTES });

  // 1번을 다시 보면 최근으로 올라가 2번이 먼저 밀려난다.
  await fetchFeedImage(1);
  await fetchFeedImage(fit + 1);
  expect(feedImageCacheStats()).toEqual({ count: fit, bytes: IMAGE_CACHE_BYTES });

  fetchMock.mockClear();
  await fetchFeedImage(1);
  expect(fetchMock).not.toHaveBeenCalled();
  await fetchFeedImage(2);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('예산보다 큰 사진 한 장도 방금 받은 것은 남겨 화면이 쓸 수 있다', async () => {
  serveImages({ 1: 1 * MB, 2: IMAGE_CACHE_BYTES + MB });
  await fetchFeedImage(1);
  await expect(fetchFeedImage(2)).resolves.toBe('data:image/jpeg;base64,2');
  expect(feedImageCacheStats()).toEqual({ count: 1, bytes: IMAGE_CACHE_BYTES + MB });
});

it('작은 사진은 장수 상한 60장에서 자른다', async () => {
  serveImages(Object.fromEntries(Array.from({ length: 61 }, (_, i) => [i + 1, 1000])));
  for (let id = 1; id <= 61; id++) await fetchFeedImage(id);
  expect(feedImageCacheStats()).toEqual({ count: 60, bytes: 60_000 });
});

it('지우면 바이트 합도 함께 돌아간다', async () => {
  serveImages({ 1: MB, 2: 2 * MB });
  await fetchFeedImage(1);
  await fetchFeedImage(2);
  clearFeedImageCache([2]);
  expect(feedImageCacheStats()).toEqual({ count: 1, bytes: MB });
  clearFeedImageCache();
  expect(feedImageCacheStats()).toEqual({ count: 0, bytes: 0 });
});
