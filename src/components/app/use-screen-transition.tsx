import { type ReactNode, useLayoutEffect, useReducer, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { useAppFrame } from '@/hooks/use-app-frame';
import {
  BACK_SCREEN,
  livesInPager,
  type Screen,
  TAB_FOR_SCREEN,
} from '@/components/app/navigation';
import type { NavTab } from '@/components/ui/bottom-nav';
import { useAnimatedValue } from '@/hooks/use-stable-value';
import { NATIVE_DRIVER } from '@/utils/animation';

type Slot = 'a' | 'b';
/** 화면이 사는 층 — 탭 화면은 상주 층(`tabs`), 서브화면은 a/b 둘을 번갈아 쓴다. */
type Holder = 'tabs' | Slot;
type Direction = 'push' | 'pop';

export type ScreenLayer = {
  key: Holder;
  node: ReactNode;
  style: {
    transform: { translateX: Animated.AnimatedInterpolation<number> | Animated.Value }[];
    zIndex: number;
  };
  /**
   * 현재 화면의 층만 터치를 받는다 — 떠나는 층은 300ms 안에 두 번 눌리는 사고를 막고, 비어 있는 층은
   * 화면 전체를 덮는 빈 뷰라 밑의 층으로 가는 터치를 가로채지 않게 한다.
   */
  pointerEvents: 'auto' | 'none';
  /** 서브화면 밑에 깔려 쉬는 탭 층 — 마운트는 유지하되 그리지도, 읽히지도 않는다. */
  hidden: boolean;
};

/**
 * 페이저가 서 있을 탭. 서브화면에 있는 동안에는 마지막 탭을 그대로 든다 — 탭 층이 밑에 살아 있으므로
 * (아래 `useScreenTransition`) 인덱스가 흔들리면 돌아왔을 때 다른 탭에 서 있게 된다.
 */
export function usePagerTab(screen: Screen): NavTab {
  const tab = TAB_FOR_SCREEN[screen] ?? (screen === 'calendarWeek' ? 'calendar' : null);
  const lastRef = useRef<NavTab>(tab ?? 'myRoom');
  if (tab != null) lastRef.current = tab;
  return lastRef.current;
}

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
  holder: Holder;
  /** 마지막으로 쓴 서브 층 — 다음 서브화면은 반대쪽에 선다. */
  lastSlot: Slot;
  /** 현재 서브화면의 최신 노드 — 다음 전환 때 "떠나는 층"이 된다. */
  node: ReactNode;
  /** 떠나는 층. 탭 층은 스테일 노드를 들지 않는다(상주 노드가 그대로 밀려난다). */
  exiting: { holder: Holder; node: ReactNode; direction: Direction } | null;
  /** 탭 층은 탭 화면이 처음 뜬 뒤로 계속 마운트해 둔다 — 서브화면에서 시작한 실행은 그때까지 미룬다. */
  tabsMounted: boolean;
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
 *
 * **탭 화면은 상주 층에 산다 (2026-11-11 제보)** — 종전엔 탭 화면도 a/b 층의 한 화면이라, 서브화면에
 * 들어가면 300ms 뒤 페이저(다섯 탭)가 통째로 언마운트되고 돌아올 때 다시 마운트됐다. 그 마운트가
 * 복귀 슬라이드와 같은 프레임에 걸려 UI 스레드가 약 240ms 멈췄다(갤럭시 S25 울트라 녹화: 복귀
 * 300ms에 고유 프레임 6~11장). 주간 보기(#1327)에서 같은 증상을 페이저를 살려 두는 것으로 고쳤던
 * 것을 모든 서브화면으로 넓힌다. 탭 층은 서브화면 밑에서 `hidden`(안 그림·터치 없음·접근성 숨김)으로
 * 쉬다가, 돌아올 때 마운트 없이 그대로 밀려 들어온다. 스크롤 위치도 그대로 남는다.
 */
export function useScreenTransition({
  screen,
  addReturnScreen,
  tabsNode,
  node,
}: {
  screen: Screen;
  addReturnScreen: Screen;
  /** 탭 페이저 — 상주 층에 그린다. 셸이 매 렌더 새로 만들고, 스테일로 붙들지 않는다. */
  tabsNode: ReactNode;
  /** 현재 `screen`의 서브화면 트리 — 셸이 매 렌더 새로 만든다. 탭 화면에서는 비어 있다. */
  node: ReactNode;
}): ScreenLayer[] {
  // 슬라이드 거리는 앱 프레임 폭 — 웹 데스크톱에서 화면이 창 밖 1500px에서 날아오지 않게.
  const { width } = useAppFrame();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const enterX = useAnimatedValue(0);
  const exitX = useAnimatedValue(0);
  const stateRef = useRef<TransitionState>(
    livesInPager(screen)
      ? {
          screen,
          holder: 'tabs',
          lastSlot: 'b',
          node,
          exiting: null,
          tabsMounted: true,
          version: 0,
        }
      : { screen, holder: 'a', lastSlot: 'a', node, exiting: null, tabsMounted: false, version: 0 },
  );

  const state = stateRef.current;
  if (state.screen !== screen) {
    const toPager = livesInPager(screen);
    if (state.holder === 'tabs' && toPager) {
      // 탭 간 — 페이저가 그린다. 층도 그대로. 달력 탭 ↔ 주간 보기(#1327)도 층을 안 바꾼다 —
      // 화면 스스로 접힘/펼침을 연출한다.
      stateRef.current = { ...state, screen, node };
    } else {
      const direction: Direction = isBackTransition(state.screen, screen, addReturnScreen)
        ? 'pop'
        : 'push';
      const slot = other(state.lastSlot);
      stateRef.current = {
        screen,
        holder: toPager ? 'tabs' : slot,
        lastSlot: toPager ? state.lastSlot : slot,
        node,
        exiting: {
          holder: state.holder,
          node: state.holder === 'tabs' ? null : state.node,
          direction,
        },
        tabsMounted: state.tabsMounted || toPager,
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
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.timing(exitX, {
        toValue: push ? -width * UNDER_PARALLAX : width,
        duration: SCREEN_SLIDE_MS,
        easing,
        useNativeDriver: NATIVE_DRIVER,
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
  const layerFor = (holder: Holder): ScreenLayer => {
    const isCurrent = holder === current.holder;
    const isExiting = current.exiting?.holder === holder;
    const slotNode = isCurrent ? current.node : isExiting ? current.exiting!.node : null;
    return {
      key: holder,
      node: holder === 'tabs' ? (current.tabsMounted ? tabsNode : null) : slotNode,
      style: {
        transform: [{ translateX: isCurrent ? enterX : isExiting ? exitX : 0 }],
        // 진입은 새 화면이 위, 복귀는 떠나는 화면이 위.
        zIndex: isCurrent ? (push || !current.exiting ? 2 : 1) : isExiting && !push ? 2 : 1,
      } as ScreenLayer['style'],
      pointerEvents: isCurrent ? 'auto' : 'none',
      hidden: holder === 'tabs' && !isCurrent && !isExiting,
    };
  };
  return [layerFor('tabs'), layerFor('a'), layerFor('b')];
}
