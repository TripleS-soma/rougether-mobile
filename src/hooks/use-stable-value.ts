import { useRef, type MutableRefObject } from 'react';
import { Animated } from 'react-native';

/**
 * React Compiler 바일아웃 격리 (#748).
 *
 * 코드베이스는 두 관용구를 의도적으로 쓴다 — 인스턴스를 첫 렌더에 고정하는
 * `useRef(new Animated.Value(x)).current`와, 최신 값을 무의존 콜백에 넘기는
 * 렌더 중 ref 쓰기(#539 렌더 안정성 계약). 그런데 컴파일러는 "Cannot access
 * refs during render"로 **그 함수 전체를 스킵**한다 — 상주 화면(MyRoomScreen·
 * HouseScreen)과 셸이 자동 메모이제이션을 통째로 못 받고 있었다.
 *
 * 바일아웃은 함수 단위라, 관용구를 이 훅들 안에 가두면 훅만 스킵되고 호출
 * 컴포넌트는 정상 컴파일된다(최소 재현으로 검증). 동작·참조 안정성은 인라인
 * 판과 완전히 동일하다.
 */

/** 첫 렌더에 고정되는 Animated.Value — `useRef(new Animated.Value(v)).current`. */
export function useAnimatedValue(initial: number): Animated.Value {
  return useRef(new Animated.Value(initial)).current;
}

/** 첫 렌더에 고정되는 Animated.ValueXY. */
export function useAnimatedValueXY(initial?: { x: number; y: number }): Animated.ValueXY {
  return useRef(new Animated.ValueXY(initial)).current;
}

/** 첫 렌더에 한 번만 만들어지는 임의 인스턴스 — `useRef(factory()).current`. */
export function useConstant<T>(factory: () => T): T {
  const ref = useRef<T | null>(null);
  if (ref.current === null) ref.current = factory();
  return ref.current;
}

/**
 * 최신 값을 담아 두는 ref — 무의존 콜백/워클릿이 stale 값을 보지 않게 한다.
 * 렌더 중 쓰기가 필요한 계약이라 여기 가둔다.
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * 참조가 영구히 고정된 콜백. 매 렌더의 최신 클로저를 ref로 갈아끼우고
 * 호출만 위임한다 — 의존성 배열 없는 `useCallback(fn, [])`이 낡은 값을 읽는
 * 문제 없이, memo 화면으로 내려가는 prop의 참조 안정성(#539 계약)을 지킨다.
 * 컴파일러가 "수동 메모이제이션을 보존할 수 없다"며 화면 전체를 포기하던
 * 자리를 이 훅 하나로 격리한다 (#748).
 */
export function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useRef(((...args: never[]) => ref.current(...args)) as T).current;
}
