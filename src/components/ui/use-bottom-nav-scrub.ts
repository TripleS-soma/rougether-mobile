import { useMemo, useRef } from 'react';
import { type LayoutRectangle } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useStableCallback } from '@/hooks/use-stable-value';

type TabFrame = Pick<LayoutRectangle, 'x' | 'width'>;

/**
 * Use measured centers: translated labels and font scaling can give tabs unequal widths.
 * `count`는 탭 수 (#1138 — 4탭) — 전부 측정되기 전엔 -1.
 */
export function scrubTarget(x: number, frames: TabFrame[], count = 3): number {
  'worklet';
  if (!Number.isFinite(x) || frames.length !== count || frames.some((f) => !f || f.width <= 0)) {
    return -1;
  }
  for (let i = 0; i < frames.length - 1; i++) {
    const center = frames[i].x + frames[i].width / 2;
    const next = frames[i + 1].x + frames[i + 1].width / 2;
    if (x < (center + next) / 2) return i;
  }
  return frames.length - 1;
}

export function useBottomNavScrub(onSelect: (index: number) => void, count = 3) {
  const frames = useRef(useSharedValue<TabFrame[]>([])).current;
  const height = useRef(useSharedValue(0)).current;
  const dragging = useRef(useSharedValue(false)).current;
  const pointerX = useRef(useSharedValue(0)).current;
  const select = useStableCallback(onSelect);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .withTestId('bottom-nav-scrub')
        .maxPointers(1)
        .activeOffsetX([-8, 8])
        .failOffsetY([-12, 12])
        .onStart((e) => {
          'worklet';
          dragging.value = scrubTarget(e.x, frames.value, count) >= 0;
          pointerX.value = e.x;
        })
        .onUpdate((e) => {
          'worklet';
          pointerX.value = e.x;
        })
        .onEnd((e, success) => {
          'worklet';
          if (!success) return;
          const target = scrubTarget(e.x, frames.value, count);
          // Leaving the bar vertically is an escape; horizontal overshoot selects the end tab.
          if (dragging.value && target >= 0 && e.y >= -24 && e.y <= height.value + 24) {
            runOnJS(select)(target);
          }
        })
        .onFinalize(() => {
          'worklet';
          dragging.value = false;
        }),
    [frames, height, dragging, pointerX, select, count],
  );
  const indicatorStyle = useAnimatedStyle(() => {
    const target = scrubTarget(pointerX.value, frames.value, count);
    if (target < 0 || !dragging.value)
      return { opacity: 0, width: 0, transform: [{ translateX: 0 }] };
    const first = frames.value[0];
    const last = frames.value[count - 1];
    const width = frames.value[target].width;
    const center = Math.max(
      first.x + first.width / 2,
      Math.min(last.x + last.width / 2, pointerX.value),
    );
    return { opacity: 1, width, transform: [{ translateX: center - width / 2 }] };
  });
  // 측정값의 원본은 JS ref (#1102). 종전엔 `frames.value`를 JS에서 읽어 한 칸만 바꿔
  // 다시 썼는데, Android에서는 세 탭의 onLayout이 한 틱에 몰려 오면서 읽기가 직전
  // 쓰기를 못 보고 앞 탭들을 빈 칸으로 덮었다 — 끌기 시작 때 "측정 미완료"로
  // 판정돼 선택이 영영 나가지 않았다(iOS는 레이아웃이 틱마다 나뉘어 우연히 동작).
  const framesRef = useRef<TabFrame[]>([]);
  const recordTab = (index: number, frame: LayoutRectangle) => {
    const next = [...framesRef.current];
    // Keep placeholders dense so incomplete layout never passes the readiness check.
    while (next.length < count) next.push({ x: 0, width: 0 });
    next[index] = { x: frame.x, width: frame.width };
    framesRef.current = next;
    frames.value = next;
  };
  const recordHeight = (value: number) => {
    height.value = value;
  };
  return { pan, indicatorStyle, recordTab, recordHeight };
}
