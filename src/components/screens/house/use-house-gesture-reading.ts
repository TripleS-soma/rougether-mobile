import { useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { useLatestRef, useStableCallback } from '@/hooks/use-stable-value';
import { noteHouseTouch, registerGestureReader } from '@/lib/dead-drag-probe';

/**
 * 집 화면의 제스처 상태를 먹통 드래그 진단(`lib/dead-drag-probe.ts`, 2026-11-11)에 내놓는다 —
 * 자리 드래그·확대 여부와 스크롤 위치. 원인을 고치면 진단과 함께 걷어낸다.
 *
 * `onScroll`은 호출부의 기존 핸들러(스크롤 위치 복원)를 감싸 그대로 넘긴다.
 */
export function useHouseGestureReading({
  dragSeat,
  zoomed,
  onScroll,
}: {
  dragSeat: number | null;
  zoomed: boolean;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const scrollY = useRef(0);
  const latest = useLatestRef({ dragSeat, zoomed, onScroll });
  useEffect(
    () =>
      registerGestureReader('house', () => ({
        state:
          `drag${latest.current.dragSeat == null ? 0 : 1}` +
          ` zoom${latest.current.zoomed ? 1 : 0}` +
          ` y${Math.round(scrollY.current)}`,
        motion: String(Math.round(scrollY.current)),
      })),
    [latest],
  );
  const handleScroll = useStableCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    latest.current.onScroll?.(e);
  });
  return { onTouchStart: noteHouseTouch, onScroll: handleScroll };
}
