import { Gesture } from 'react-native-gesture-handler';

/**
 * Shared horizontal-fling gesture for swipe navigation (#561 방↔달력 탭 전환,
 * #562 달력 월 이동). RNGH `Gesture.Pan()` 기반 — PanResponder는 RN 웹의
 * ScrollView가 낀 트리(그리드가 ScrollView 안, 컨테이너가 ScrollView 부모)
 * 에서 move 클레임 질의를 아예 받지 못해 웹에서 죽는다. RNGH는 #560의
 * Swipeable로 웹 동작이 입증된 경로다.
 *
 * 판정 문법은 집 스와이프 전환(#297)과 동일: 가로 우세 + 최소 이동일 때만
 * 활성화해 탭·세로 스크롤을 살려두고, 놓을 때 더 큰 이동 임계를 넘겨야
 * 플링으로 인정한다.
 */

/** Minimum horizontal move (px) before the pan activates. */
export const SWIPE_CLAIM_DX = 24;
/** Horizontal dominance — 세로 실패 임계는 활성 임계의 이 배율이다. */
export const SWIPE_DOMINANCE = 1.5;
/** Vertical move (px) that fails the pan — 세로 스크롤 몫으로 넘긴다. */
export const SWIPE_FAIL_DY = SWIPE_CLAIM_DX * SWIPE_DOMINANCE;
/** Release distance (px) that counts as a fling. */
export const SWIPE_FLING_DX = 40;

/** Fling direction on release, or null when the drag fell short. */
export const flingDirection = (dx: number): 'left' | 'right' | null =>
  dx <= -SWIPE_FLING_DX ? 'left' : dx >= SWIPE_FLING_DX ? 'right' : null;

/**
 * Horizontal-fling pan gesture for a `GestureDetector`: activates only on a
 * deliberate horizontal drag (activeOffsetX ±24), fails on vertical movement
 * first (failOffsetY ±36) so nested vertical ScrollViews keep their scroll,
 * and reports the fling direction on release. 콜백이 React 상태를 만지므로
 * JS 스레드 고정(runOnJS) — 워클릿 혼용 경고도 막는다.
 */
export const horizontalFlingGesture = (testId: string, onFling: (dir: 'left' | 'right') => void) =>
  Gesture.Pan()
    .withTestId(testId)
    .runOnJS(true)
    .activeOffsetX([-SWIPE_CLAIM_DX, SWIPE_CLAIM_DX])
    .failOffsetY([-SWIPE_FAIL_DY, SWIPE_FAIL_DY])
    .onEnd((e) => {
      const dir = flingDirection(e.translationX);
      if (dir) onFling(dir);
    });
