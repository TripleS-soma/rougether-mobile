import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getSessionUserId } from '@/api/auth';
import { track } from '@/lib/analytics';
import { loadSeenTours, markTourSeen } from '@/lib/feature-tour-store';

export type FeatureTour = {
  /** 지금 오버레이를 그릴지. */
  visible: boolean;
  /** 현재 단계(0부터). */
  index: number;
  next: () => void;
  skip: () => void;
  /** 헤더 ? 버튼 — 본 적이 있어도 처음부터 다시. */
  replay: () => void;
};

/**
 * 기능 첫 진입 튜토리얼 (거래소부터) — `active`가 처음 참이 될 때 본 적이 없으면 0단계부터
 * 띄운다. 끝내거나 건너뛰면 계정별로 기록해 다시 자동으로 뜨지 않는다. 도중에 화면을 떠나면
 * (`active` 거짓) 숨겼다가 돌아오면 그 단계부터 이어 간다.
 *
 * 반환 객체와 함수는 참조가 고정이다 — 셸 memo 경계(#539)를 넘어 화면 prop으로 내려간다.
 */
export function useFeatureTour(tourId: string, stepCount: number, active: boolean): FeatureTour {
  const [seen, setSeen] = useState<boolean | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const indexRef = useRef<number | null>(null);
  indexRef.current = index;

  useEffect(() => {
    let alive = true;
    // 같은 화면이 다른 투어로 바뀌면(게임 A → B) 앞 투어의 진행을 버리고 새로 읽는다.
    setSeen(null);
    setIndex(null);
    void loadSeenTours(getSessionUserId()).then((set) => {
      if (alive) setSeen(set.has(tourId));
    });
    return () => {
      alive = false;
    };
  }, [tourId]);

  useEffect(() => {
    if (active && seen === false && indexRef.current == null) setIndex(0);
  }, [active, seen]);

  const finish = useCallback(
    (action: 'complete' | 'skip') => {
      const step = (indexRef.current ?? 0) + 1;
      setIndex(null);
      setSeen(true);
      void markTourSeen(getSessionUserId(), tourId);
      track('feature_tour', { tour: tourId, action, step });
    },
    [tourId],
  );

  const next = useCallback(() => {
    const current = indexRef.current;
    if (current == null) return;
    if (current + 1 < stepCount) setIndex(current + 1);
    else finish('complete');
  }, [stepCount, finish]);

  const skip = useCallback(() => finish('skip'), [finish]);

  const replay = useCallback(() => {
    setIndex(0);
    track('feature_tour', { tour: tourId, action: 'replay', step: 1 });
  }, [tourId]);

  const visible = active && index != null;
  return useMemo(
    () => ({ visible, index: index ?? 0, next, skip, replay }),
    [visible, index, next, skip, replay],
  );
}
