import * as StoreReview from 'expo-store-review';
import { useEffect, useRef } from 'react';

import { track } from '@/lib/analytics';
import {
  readStoreReviewState,
  shouldRequestReview,
  type StoreReviewState,
  writeStoreReviewState,
} from '@/lib/store-review';

/** 보상 알약(#1055, 2.2초)이 사라진 뒤에 시트를 띄운다 — 축하 위에 겹치지 않게. */
export const REVIEW_PROMPT_DELAY_MS = 2600;

/**
 * 스토어 리뷰 요청 (#1107) — "오늘 루틴 전부 완료" 순간에만 시스템 리뷰 시트를
 * 요청한다. 조건(설치 3일+, 완료 10회+, 90일 쿨다운)은 `lib/store-review`의 순수
 * 판정. 실제로 뜨는지는 OS 쿼터가 정하므로 요청 사실만 계측한다.
 *
 * - `doneCount`/`totalCount`: 오늘 예정 루틴 중 완료 수와 전체 수. 완료가 **늘어난**
 *   순간만 세고(초기 로드·취소는 제외), 늘어나며 전부 완료가 된 순간에 요청한다.
 * - `ready`: 초기 로드가 끝났는가 — 끝나기 전 값 변화는 세지 않는다.
 * - `suppressed`: 띄우면 안 되는 순간(에러 토스트·시트 열림 등). 호출 쪽이 판단.
 */
export function useStoreReview({
  doneCount,
  totalCount,
  ready,
  suppressed = false,
}: {
  doneCount: number;
  totalCount: number;
  ready: boolean;
  suppressed?: boolean;
}) {
  const stateRef = useRef<StoreReviewState | null>(null);
  const prevDoneRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    void readStoreReviewState(Date.now()).then((s) => {
      if (!active) return;
      stateRef.current = s;
      // 첫 실행이면 firstOpenAt을 지금으로 남긴다.
      void writeStoreReviewState(s);
    });
    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const prev = prevDoneRef.current;
    prevDoneRef.current = doneCount;
    // 첫 관측·감소(취소)·로드 교체는 세지 않는다.
    if (prev === null || doneCount <= prev) return;
    const state = stateRef.current;
    if (!state) return;
    const next = { ...state, completions: state.completions + (doneCount - prev) };
    stateRef.current = next;
    void writeStoreReviewState(next);

    const allDone = totalCount > 0 && doneCount >= totalCount;
    if (!allDone || suppressed) return;
    const now = Date.now();
    if (!shouldRequestReview(next, now)) return;

    // 요청은 한 번만 기록 — OS가 실제로 띄우지 않아도 다음은 90일 뒤.
    const requested = { ...next, lastRequestedAt: now };
    stateRef.current = requested;
    void writeStoreReviewState(requested);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void (async () => {
        try {
          if (!(await StoreReview.hasAction())) return;
          track('review_prompt_requested', { completions: requested.completions });
          await StoreReview.requestReview();
        } catch {
          // 리뷰 시트 실패는 사용자에게 아무 일도 아니다.
        }
      })();
    }, REVIEW_PROMPT_DELAY_MS);
  }, [doneCount, totalCount, ready, suppressed]);
}
