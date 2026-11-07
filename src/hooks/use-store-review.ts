import * as StoreReview from 'expo-store-review';
import { useEffect, useRef } from 'react';

import { track } from '@/lib/analytics';
import {
  readStoreReviewState,
  type ReviewTrigger,
  shouldRequestReview,
  STREAK_MILESTONES,
  type StoreReviewState,
  writeStoreReviewState,
} from '@/lib/store-review';

/** 보상 알약(#1055, 2.2초)이 사라진 뒤에 시트를 띄운다 — 축하 위에 겹치지 않게. */
export const REVIEW_PROMPT_DELAY_MS = 2600;

/*
 * 저장값은 모듈 하나가 쥔다 (#1678) — 완료를 세는 훅과, 훅 밖의 좋은 순간(미션 보상·방 저장)이
 * 같은 쿨다운을 보게. 앱 프로세스에 하나라 세션 안에서 두 번 요청하지 않는다.
 */
let memState: StoreReviewState | null = null;
let loading: Promise<StoreReviewState> | null = null;
let scheduled: ReturnType<typeof setTimeout> | null = null;

function loadState(): Promise<StoreReviewState> {
  if (memState) return Promise.resolve(memState);
  loading ??= readStoreReviewState(Date.now()).then((s) => {
    memState = s;
    // 첫 실행이면 firstOpenAt을 지금으로 남긴다.
    void writeStoreReviewState(s);
    return s;
  });
  return loading;
}

function saveState(next: StoreReviewState) {
  memState = next;
  void writeStoreReviewState(next);
}

/** 테스트 전용 — 모듈 상태를 비운다. */
export function __resetStoreReview() {
  memState = null;
  loading = null;
  if (scheduled) clearTimeout(scheduled);
  scheduled = null;
}

/**
 * 좋은 순간에 시스템 리뷰 시트를 요청한다 (#1107·#1678). 조건(설치 2일+, 완료 5회+, 90일
 * 쿨다운)은 `lib/store-review`의 순수 판정. 실제로 뜨는지는 OS 쿼터가 정하므로 요청 사실만
 * 계측한다. 축하 연출 위에 겹치지 않게 REVIEW_PROMPT_DELAY_MS 뒤에 띄운다.
 */
export function requestReviewAtGoodMoment(trigger: ReviewTrigger): void {
  void (async () => {
    const state = await loadState();
    const now = Date.now();
    if (scheduled || !shouldRequestReview(state, now)) return;
    // 요청은 한 번만 기록 — OS가 실제로 띄우지 않아도 다음은 90일 뒤.
    const requested = { ...state, lastRequestedAt: now };
    saveState(requested);
    scheduled = setTimeout(() => {
      scheduled = null;
      void (async () => {
        try {
          if (!(await StoreReview.hasAction())) return;
          track('review_prompt_requested', {
            completions: requested.completions,
            from: trigger,
          });
          await StoreReview.requestReview();
        } catch {
          // 리뷰 시트 실패는 사용자에게 아무 일도 아니다.
        }
      })();
    }, REVIEW_PROMPT_DELAY_MS);
  })();
}

/**
 * 루틴 쪽 좋은 순간 (#1107·#1678) — 완료를 세고, "오늘 루틴 전부 완료"와 "연속 달성
 * 마일스톤"에 닿은 순간 리뷰를 요청한다.
 *
 * - `doneCount`/`totalCount`: 오늘 예정 루틴 중 완료 수와 전체 수. 완료가 **늘어난**
 *   순간만 세고(초기 로드·취소는 제외), 늘어나며 전부 완료가 된 순간에 요청한다.
 * - `streak`: 연속 달성 일수. **늘어나며** 마일스톤에 닿은 순간에 요청한다(첫 관측 제외).
 * - `ready`: 초기 로드가 끝났는가 — 끝나기 전 값 변화는 세지 않는다.
 * - `suppressed`: 띄우면 안 되는 순간(에러 토스트·시트 열림 등). 호출 쪽이 판단.
 */
export function useStoreReview({
  doneCount,
  totalCount,
  streak,
  ready,
  suppressed = false,
}: {
  doneCount: number;
  totalCount: number;
  streak?: number;
  ready: boolean;
  suppressed?: boolean;
}) {
  const prevDoneRef = useRef<number | null>(null);
  const prevStreakRef = useRef<number | null>(null);

  useEffect(() => {
    void loadState();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const prev = prevDoneRef.current;
    prevDoneRef.current = doneCount;
    // 첫 관측·감소(취소)·로드 교체는 세지 않는다.
    if (prev === null || doneCount <= prev) return;
    const added = doneCount - prev;
    const allDone = totalCount > 0 && doneCount >= totalCount;
    void loadState().then((state) => {
      saveState({ ...state, completions: state.completions + added });
      if (allDone && !suppressed) requestReviewAtGoodMoment('all_done');
    });
  }, [doneCount, totalCount, ready, suppressed]);

  useEffect(() => {
    if (!ready || streak == null) return;
    const prev = prevStreakRef.current;
    prevStreakRef.current = streak;
    if (prev === null || streak <= prev) return;
    if (!suppressed && STREAK_MILESTONES.includes(streak)) requestReviewAtGoodMoment('streak');
  }, [streak, ready, suppressed]);
}
