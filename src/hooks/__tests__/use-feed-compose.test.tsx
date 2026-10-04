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

const ROUTINE = { routineId: 15, date: '2026-10-04' };

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

  describe('게시판 (서버 #428)', () => {
    it('기본은 자유게시판 — 사진 없이 본문만 boardType FREE·빈 imageIds로 보낸다', async () => {
      const { result } = await renderHook(() => useFeedCompose(), { wrapper: queryWrapper() });
      expect(result.current.board).toBe('FREE');
      expect(result.current.canSubmit).toBe(false);
      await act(async () => {
        result.current.setContent('  글만 올려요 ');
      });
      expect(result.current.canSubmit).toBe(true);
      await act(async () => {
        await result.current.submit();
      });
      expect(jest.mocked(createFeedPost).mock.calls[0][0]).toMatchObject({
        boardType: 'FREE',
        content: '글만 올려요',
        imageIds: [],
      });
    });

    it('인증게시판은 사진 없이 게시하지 않고 안내한다', async () => {
      const onError = jest.fn();
      const { result } = await renderHook(() => useFeedCompose({ onError }), {
        wrapper: queryWrapper(),
      });
      await act(async () => {
        result.current.setBoard('VERIFICATION');
        result.current.setContent('본문만');
      });
      expect(result.current.canSubmit).toBe(false);
      await act(async () => {
        await result.current.submit();
      });
      expect(createFeedPost).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('사진을 한 장 이상 골라 주세요.');
    });

    it('자유게시판의 빈 글은 보내지 않는다', async () => {
      const onError = jest.fn();
      const { result } = await renderHook(() => useFeedCompose({ onError }), {
        wrapper: queryWrapper(),
      });
      await act(async () => {
        result.current.setContent('   ');
        await result.current.submit();
      });
      expect(createFeedPost).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('본문을 쓰거나 사진을 골라 주세요.');
    });

    it('실패 후 게시판만 바꿔 보내도 새 clientPostId (같은 id·다른 게시판은 서버가 409)', async () => {
      jest.mocked(createFeedPost).mockRejectedValueOnce(new Error('network'));
      const { result } = await withUploaded();
      await act(async () => {
        await result.current.submit();
      });
      await act(async () => {
        result.current.setBoard('VERIFICATION');
        result.current.setRoutine(ROUTINE);
      });
      await act(async () => {
        await result.current.submit();
      });
      const [first, second] = jest.mocked(createFeedPost).mock.calls.map((c) => c[0]);
      expect(first.boardType).toBe('FREE');
      expect(second).toMatchObject({ boardType: 'VERIFICATION', imageIds: [100, 101] });
      expect(second.clientPostId).not.toBe(first.clientPostId);
    });

    it('인증게시판은 루틴을 고르기 전엔 게시하지 않고 안내한다 (서버 #430)', async () => {
      const onError = jest.fn();
      const { result } = await withUploaded(onError);
      await act(async () => {
        result.current.setBoard('VERIFICATION');
      });
      expect(result.current.canSubmit).toBe(false);
      await act(async () => {
        await result.current.submit();
      });
      expect(createFeedPost).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('인증할 루틴을 골라 주세요.');

      await act(async () => {
        result.current.setRoutine(ROUTINE);
      });
      expect(result.current.canSubmit).toBe(true);
      await act(async () => {
        await result.current.submit();
      });
      expect(jest.mocked(createFeedPost).mock.calls[0][0]).toMatchObject({
        boardType: 'VERIFICATION',
        imageIds: [100, 101],
        routineCompletion: ROUTINE,
      });
    });

    it('자유게시판으로 바꾸면 골라 둔 루틴을 보내지 않는다', async () => {
      const { result } = await withUploaded();
      await act(async () => {
        result.current.setBoard('VERIFICATION');
        result.current.setRoutine(ROUTINE);
      });
      await act(async () => {
        result.current.setBoard('FREE');
      });
      await act(async () => {
        await result.current.submit();
      });
      const body = jest.mocked(createFeedPost).mock.calls[0][0];
      expect(body.boardType).toBe('FREE');
      expect(body).not.toHaveProperty('routineCompletion');
    });

    it('실패 후 루틴만 바꿔 보내도 새 clientPostId (같은 id·다른 루틴은 서버가 409)', async () => {
      jest.mocked(createFeedPost).mockRejectedValueOnce(new Error('network'));
      const { result } = await withUploaded();
      await act(async () => {
        result.current.setBoard('VERIFICATION');
        result.current.setRoutine(ROUTINE);
      });
      await act(async () => {
        await result.current.submit();
      });
      await act(async () => {
        result.current.setRoutine({ routineId: 16, date: '2026-10-03' });
      });
      await act(async () => {
        await result.current.submit();
      });
      const [first, second] = jest.mocked(createFeedPost).mock.calls.map((c) => c[0]);
      expect(second.routineCompletion).toEqual({ routineId: 16, date: '2026-10-03' });
      expect(second.clientPostId).not.toBe(first.clientPostId);
    });

    it('작성을 버리면 게시판도 기본(자유)으로 돌아간다', async () => {
      const { result } = await renderHook(() => useFeedCompose(), { wrapper: queryWrapper() });
      await act(async () => {
        result.current.setBoard('VERIFICATION');
        result.current.setRoutine(ROUTINE);
      });
      await act(async () => {
        result.current.discard();
      });
      expect(result.current.board).toBe('FREE');
      expect(result.current.routine).toBeNull();
    });
  });
});
