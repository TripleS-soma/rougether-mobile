import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createFeedPost, deleteFeedImage, uploadFeedImage } from '@/api/feed';
import { useFeedCompose } from '@/hooks/use-feed-compose';
import { DEMO_FEED_POSTS } from '@/mocks/fixtures';
import { queryWrapper } from '@/test-utils/query-wrapper';

jest.mock('@/api/feed', () => ({
  uploadFeedImage: jest.fn(),
  deleteFeedImage: jest.fn(),
  createFeedPost: jest.fn(),
}));

const photo = (name: string, type = 'image/jpeg', fileSize = 1024) => ({
  uri: `file:///${name}`,
  name,
  type,
  fileSize,
});

let nextImageId = 100;
beforeEach(() => {
  nextImageId = 100;
  jest
    .mocked(uploadFeedImage)
    .mockReset()
    .mockImplementation(async () => ({
      imageId: nextImageId++,
    }));
  jest.mocked(deleteFeedImage).mockReset().mockResolvedValue(undefined);
  jest.mocked(createFeedPost).mockReset().mockResolvedValue(DEMO_FEED_POSTS[0]);
});

async function withUploaded(onError = jest.fn()) {
  const hook = await renderHook(() => useFeedCompose({ onError }), { wrapper: queryWrapper() });
  await act(async () => {
    hook.result.current.addImages([photo('a.jpg'), photo('b.png', 'image/png')]);
  });
  await waitFor(() => expect(hook.result.current.canSubmit).toBe(true));
  return hook;
}

describe('useFeedCompose (#1409)', () => {
  it('고른 사진을 곧바로 올리고, 전부 올라가야 게시할 수 있다', async () => {
    const { result } = await withUploaded();
    expect(uploadFeedImage).toHaveBeenCalledTimes(2);
    expect(result.current.images.map((i) => i.imageId)).toEqual([100, 101]);
  });

  it('JPEG/PNG가 아니거나 10MiB를 넘는 사진은 빼고 안내한다', async () => {
    const onError = jest.fn();
    const { result } = await renderHook(() => useFeedCompose({ onError }), {
      wrapper: queryWrapper(),
    });
    await act(async () => {
      result.current.addImages([
        photo('a.heic', 'image/heic'),
        photo('big.jpg', 'image/jpeg', 11 * 1024 * 1024),
      ]);
    });
    expect(result.current.images).toHaveLength(0);
    expect(uploadFeedImage).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('JPEG·PNG 사진만 올릴 수 있어요.');
  });

  it('게시 재시도는 같은 clientPostId, 본문을 바꾸면 새 id', async () => {
    jest.mocked(createFeedPost).mockRejectedValueOnce(new Error('network'));
    const onError = jest.fn();
    const { result } = await withUploaded(onError);
    await act(async () => {
      result.current.setContent('  오늘 루틴 완료!  ');
    });

    let posted: unknown = 'unset';
    await act(async () => {
      posted = await result.current.submit();
    });
    expect(posted).toBeNull();
    expect(onError).toHaveBeenCalled();

    await act(async () => {
      posted = await result.current.submit();
    });
    const [first, second] = jest.mocked(createFeedPost).mock.calls.map((c) => c[0]);
    expect(first).toMatchObject({ content: '오늘 루틴 완료!', imageIds: [100, 101] });
    expect(second.clientPostId).toBe(first.clientPostId);
    expect(posted).toEqual(DEMO_FEED_POSTS[0]);
    // 성공하면 초안이 비워진다.
    expect(result.current.images).toHaveLength(0);
    expect(result.current.content).toBe('');
  });

  it('실패 후 본문을 고쳐 보내면 새 clientPostId (같은 id·다른 본문은 서버가 409)', async () => {
    jest.mocked(createFeedPost).mockRejectedValueOnce(new Error('network'));
    const { result } = await withUploaded();
    await act(async () => {
      await result.current.submit();
    });
    await act(async () => {
      result.current.setContent('고친 본문');
    });
    await act(async () => {
      await result.current.submit();
    });
    const [first, second] = jest.mocked(createFeedPost).mock.calls.map((c) => c[0]);
    expect(second.clientPostId).not.toBe(first.clientPostId);
  });

  it('올라간 사진을 빼거나 작성을 버리면 서버 업로드도 취소한다', async () => {
    const { result } = await withUploaded();
    await act(async () => {
      result.current.removeImage(result.current.images[0].key);
    });
    expect(deleteFeedImage).toHaveBeenCalledWith(100);
    await act(async () => {
      result.current.discard();
    });
    expect(deleteFeedImage).toHaveBeenCalledWith(101);
    expect(result.current.images).toHaveLength(0);
  });

  it('업로드 실패는 그 장만 실패로 두고 다시 올릴 수 있다', async () => {
    jest.mocked(uploadFeedImage).mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => useFeedCompose(), { wrapper: queryWrapper() });
    await act(async () => {
      result.current.addImages([photo('a.jpg')]);
    });
    await waitFor(() => expect(result.current.images[0].status).toBe('failed'));
    expect(result.current.canSubmit).toBe(false);

    await act(async () => {
      result.current.retryImage(result.current.images[0].key);
    });
    await waitFor(() => expect(result.current.images[0].status).toBe('done'));
    expect(result.current.canSubmit).toBe(true);
  });
});
