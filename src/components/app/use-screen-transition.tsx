import { type ReactNode, useLayoutEffect, useReducer, useRef } from 'react';
import { Animated, Easing, useWindowDimensions } from 'react-native';

import { BACK_SCREEN, type Screen, TAB_FOR_SCREEN } from '@/components/app/navigation';
import { useAnimatedValue } from '@/hooks/use-stable-value';

type Slot = 'a' | 'b';
type Direction = 'push' | 'pop';

export type ScreenLayer = {
  key: Slot;
  node: ReactNode;
  style: {
    transform: { translateX: Animated.AnimatedInterpolation<number> | Animated.Value }[];
    zIndex: number;
  };
  /** 떠나는 층은 터치를 받지 않는다 — 300ms 안에 두 번 눌리는 사고 방지. */
  pointerEvents: 'auto' | 'none';
};

/** 슬라이드 시간 — 네이티브 push(약 350ms)보다 살짝 빠르게, 페이드(300)와 같은 결. */
export const SCREEN_SLIDE_MS = 300;
/** 밑에 깔리는 층이 함께 밀리는 비율 — iOS 내비게이션의 패럴랙스. */
const UNDER_PARALLAX = 0.3;

/**
 * 뒤로 복귀인지 (#446 판정 그대로) — 백맵 목적지·연 곳으로의 복귀·서브→탭.
 */
export function isBackTransition(prev: Screen, next: Screen, addReturnScreen: Screen): boolean {
  return (
    BACK_SCREEN[prev] === next ||
    ((prev === 'addRoutine' || prev === 'weeklyReport') && next === addReturnScreen) ||
    TAB_FOR_SCREEN[next] != null
  );
}

type TransitionState = {
  screen: Screen;
  /** 현재 화면이 사는 층. 같은 화면이 유지되는 동안 바뀌지 않는다 — 리마운트 금지. */
  slot: Slot;
  /** 현재 화면의 최신 노드 — 다음 전환 때 "떠나는 층"이 된다. */
  node: ReactNode;
  exiting: { slot: Slot; node: ReactNode; direction: Direction } | null;
  version: number;
};

const other = (s: Slot): Slot => (s === 'a' ? 'b' : 'a');

/**
 * 서브화면 슬라이드 전환 (#1094) — 종전(#446)의 "새 화면만 페이드+살짝 밀림"은
 * 깜빡임으로 읽혔다. 네이티브 push/pop처럼 **두 화면이 동시에** 움직인다:
 * 진입은 새 화면이 오른쪽에서 덮어 들어오고 밑 화면이 조금 따라 밀리며, 복귀는
 * 떠나는 화면이 오른쪽으로 빠지면서 밑에서 이전 화면이 돌아온다.
 *
 * 셸은 화면을 `screen` 상태 하나로 그리므로(#692) 이전 화면을 "다시 그릴" 수
 * 없다. 대신 **직전 렌더의 노드**를 300ms 동안 그대로 들고 있는다(스테일
 * 엘리먼트 — 같은 층 자리에 그대로 두므로 리마운트되지 않고, 새 데이터도 받지
 * 않는다). 층은 a/b 둘이고 화면이 바뀔 때만 자리를 바꾼다 — 현재 화면은 전환
 * 중에도 같은 층에 머물러 마운트 이펙트가 두 번 돌지 않는다.
 *
 * 탭 간 전환은 페이저(#563)가 손가락 추종으로 직접 그리므로 여기선 층을 바꾸지
 * 않는다. 렌더 단계에서 ref를 갱신하는 건 같은 `screen`이면 멱등이라 StrictMode
 * 이중 렌더에도 안전하다.
 */
export function useScreenTransition({
  screen,
  addReturnScreen,
  node,
}: {
  screen: Screen;
  addReturnScreen: Screen;
  /** 현재 `screen`의 화면 트리 — 셸이 매 렌더 새로 만든다. */
  node: ReactNode;
}): ScreenLayer[] {
  const { width } = useWindowDimensions();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const enterX = useAnimatedValue(0);
  const exitX = useAnimatedValue(0);
  const stateRef = useRef<TransitionState>({ screen, slot: 'a', node, exiting: null, version: 0 });

  const state = stateRef.current;
  if (state.screen !== screen) {
    const prevTab = TAB_FOR_SCREEN[state.screen];
    const nextTab = TAB_FOR_SCREEN[screen];
    if (prevTab != null && nextTab != null) {
      // 탭 간 — 페이저가 그린다. 층도 그대로.
      stateRef.current = { ...state, screen, node };
    } else {
      const direction: Direction = isBackTransition(state.screen, screen, addReturnScreen)
        ? 'pop'
        : 'push';
      stateRef.current = {
        screen,
        slot: other(state.slot),
        node,
        exiting: { slot: state.slot, node: state.node, direction },
        version: state.version + 1,
      };
    }
  } else {
    // 같은 화면 — 최신 노드만 갈아 끼운다(전환 중이면 떠나는 층은 그대로).
    state.node = node;
  }

  const { version, exiting } = stateRef.current;
  useLayoutEffect(() => {
    if (version === 0 || !exiting) return;
    // 진입: 새 화면 width→0 위로, 밑 화면 0→-width·0.3. 복귀: 떠나는 화면 0→width 위로,
    // 밑(이전) 화면 -width·0.3→0. 페인트 전에 시작값을 둬야 한 프레임 겹침이 없다.
    const push = exiting.direction === 'push';
    enterX.setValue(push ? width : -width * UNDER_PARALLAX);
    exitX.setValue(0);
    const easing = Easing.out(Easing.cubic);
    const anim = Animated.parallel([
      Animated.timing(enterX, {
        toValue: 0,
        duration: SCREEN_SLIDE_MS,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(exitX, {
        toValue: push ? -width * UNDER_PARALLAX : width,
        duration: SCREEN_SLIDE_MS,
        easing,
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (!finished) return;
      // 떠나는 층을 비운다 — 같은 version의 전환일 때만(그 사이 또 바뀌었으면 새 전환이 맡는다).
      if (stateRef.current.version !== version) return;
      stateRef.current = { ...stateRef.current, exiting: null };
      enterX.setValue(0);
      rerender();
    });
    return () => anim.stop();
  }, [version, exiting, width, enterX, exitX]);

  const current = stateRef.current;
  const push = current.exiting?.direction === 'push';
  const layerFor = (slot: Slot): ScreenLayer => {
    const isCurrent = slot === current.slot;
    const isExiting = current.exiting?.slot === slot;
    return {
      key: slot,
      node: isCurrent ? current.node : isExiting ? current.exiting!.node : null,
      style: {
        transform: [{ translateX: isCurrent ? enterX : isExiting ? exitX : 0 }],
        // 진입은 새 화면이 위, 복귀는 떠나는 화면이 위.
        zIndex: isCurrent ? (push || !current.exiting ? 2 : 1) : isExiting && !push ? 2 : 1,
      } as ScreenLayer['style'],
      pointerEvents: isExiting ? 'none' : 'auto',
    };
  };
  return [layerFor('a'), layerFor('b')];
}
