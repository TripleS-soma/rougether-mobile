import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  COOLDOWN_DAYS,
  initialStoreReviewState,
  MIN_COMPLETIONS,
  MIN_DAYS_SINCE_FIRST_OPEN,
  readStoreReviewState,
  shouldRequestReview,
  writeStoreReviewState,
} from '@/lib/store-review';

const DAY = 24 * 60 * 60 * 1000;

// 스토어 리뷰 요청 조건 (#1107) — 설치 3일+, 완료 10회+, 90일 쿨다운.
describe('shouldRequestReview', () => {
  const t0 = 1_700_000_000_000;
  const eligible = {
    firstOpenAt: t0,
    completions: MIN_COMPLETIONS,
    lastRequestedAt: null,
  };
  const later = t0 + MIN_DAYS_SINCE_FIRST_OPEN * DAY;

  it('조건을 다 채우면 요청한다', () => {
    expect(shouldRequestReview(eligible, later)).toBe(true);
  });

  it('설치 3일 전이면 안 한다', () => {
    expect(shouldRequestReview(eligible, later - 1)).toBe(false);
  });

  it('완료 10회 미만이면 안 한다', () => {
    expect(shouldRequestReview({ ...eligible, completions: MIN_COMPLETIONS - 1 }, later)).toBe(
      false,
    );
  });

  it('요청한 지 90일 안이면 안 하고, 지나면 다시 한다', () => {
    const requested = { ...eligible, lastRequestedAt: later };
    expect(shouldRequestReview(requested, later + COOLDOWN_DAYS * DAY - 1)).toBe(false);
    expect(shouldRequestReview(requested, later + COOLDOWN_DAYS * DAY)).toBe(true);
  });
});

describe('store-review 보관', () => {
  it('없으면 지금을 첫 실행으로, 깨진 값은 기본으로', async () => {
    expect(await readStoreReviewState(123)).toEqual(initialStoreReviewState(123));
    await AsyncStorage.setItem('rougether.store-review', '{broken');
    expect(await readStoreReviewState(456)).toEqual(initialStoreReviewState(456));
  });

  it('쓴 값을 그대로 읽는다', async () => {
    const s = { firstOpenAt: 1, completions: 7, lastRequestedAt: 9 };
    await writeStoreReviewState(s);
    expect(await readStoreReviewState(999)).toEqual(s);
  });
});
