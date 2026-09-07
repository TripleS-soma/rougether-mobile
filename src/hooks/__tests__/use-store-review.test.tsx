import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as StoreReview from 'expo-store-review';

import { REVIEW_PROMPT_DELAY_MS, useStoreReview } from '@/hooks/use-store-review';
import { track } from '@/lib/analytics';
import { STORE_REVIEW_KEY } from '@/lib/store-review';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const DAY = 24 * 60 * 60 * 1000;

/** 설치 10일 전, 완료 9회 — 다음 완료 하나로 조건이 찬다. */
const seed = (extra: Partial<{ completions: number; lastRequestedAt: number | null }> = {}) =>
  AsyncStorage.setItem(
    STORE_REVIEW_KEY,
    JSON.stringify({
      firstOpenAt: Date.now() - 10 * DAY,
      completions: 9,
      lastRequestedAt: null,
      ...extra,
    }),
  );

// 스토어 리뷰 요청 (#1107) — 오늘 루틴 전부 완료가 되는 완료 순간에만.
describe('useStoreReview', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
    jest.mocked(StoreReview.requestReview).mockClear();
    jest.mocked(StoreReview.hasAction).mockClear().mockResolvedValue(true);
    jest.mocked(track).mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('마지막 루틴을 완료해 전부 완료가 되면 보상 알약 뒤에 시트를 요청한다', async () => {
    await seed();
    const { result, rerender } = await renderHook(
      (p: { done: number; total: number }) =>
        useStoreReview({ doneCount: p.done, totalCount: p.total, ready: true }),
      { initialProps: { done: 2, total: 3 } },
    );
    void result;
    // 저장값 로드 대기.
    await act(async () => {
      await Promise.resolve();
    });
    await rerender({ done: 3, total: 3 });
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(REVIEW_PROMPT_DELAY_MS);
    });
    await waitFor(() => expect(StoreReview.requestReview).toHaveBeenCalledTimes(1));
    expect(track).toHaveBeenCalledWith('review_prompt_requested', { completions: 10 });
    // 요청 사실이 남아 같은 세션 안에서 다시 전부 완료해도 요청하지 않는다.
    const saved = JSON.parse((await AsyncStorage.getItem(STORE_REVIEW_KEY)) ?? '{}');
    expect(typeof saved.lastRequestedAt).toBe('number');
  });

  it('완료 취소(감소)·초기 로드·조건 미달은 요청하지 않는다', async () => {
    await seed({ completions: 3 });
    const { rerender } = await renderHook(
      (p: { done: number; total: number; ready: boolean }) =>
        useStoreReview({ doneCount: p.done, totalCount: p.total, ready: p.ready }),
      { initialProps: { done: 0, total: 3, ready: false } },
    );
    await act(async () => {
      await Promise.resolve();
    });
    // 로드 중 값 변화는 세지 않는다.
    await rerender({ done: 3, total: 3, ready: false });
    await rerender({ done: 3, total: 3, ready: true });
    // 취소 뒤 다시 완료 — 완료 4회로 조건(10) 미달.
    await rerender({ done: 2, total: 3, ready: true });
    await rerender({ done: 3, total: 3, ready: true });
    await act(async () => {
      jest.advanceTimersByTime(REVIEW_PROMPT_DELAY_MS * 2);
    });
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    const saved = JSON.parse((await AsyncStorage.getItem(STORE_REVIEW_KEY)) ?? '{}');
    expect(saved.completions).toBe(4);
  });

  it('OS가 액션이 없다고 하면(쿼터) 조용히 지나간다', async () => {
    await seed();
    jest.mocked(StoreReview.hasAction).mockResolvedValue(false);
    const { rerender } = await renderHook(
      (p: { done: number }) => useStoreReview({ doneCount: p.done, totalCount: 1, ready: true }),
      { initialProps: { done: 0 } },
    );
    await act(async () => {
      await Promise.resolve();
    });
    await rerender({ done: 1 });
    await act(async () => {
      jest.advanceTimersByTime(REVIEW_PROMPT_DELAY_MS);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
