/**
 * Shared horizontal-fling judgment for swipe navigation (#561 방↔달력 탭 전환,
 * #562 달력 월 이동). 집 스와이프 전환(#297, house-screen)과 같은 문법:
 * 가로 우세 + 최소 이동일 때만 responder를 클레임해 탭·세로 스크롤을
 * 살려두고, 놓을 때 더 큰 이동 임계를 넘겨야 플링으로 인정한다.
 */

/** Minimum horizontal move (px) before the responder claims the gesture. */
export const SWIPE_CLAIM_DX = 24;
/** Horizontal dominance — |dx| must beat |dy| by this factor to claim. */
export const SWIPE_DOMINANCE = 1.5;
/** Release distance (px) that counts as a fling. */
export const SWIPE_FLING_DX = 40;

/** True for a deliberate horizontal-dominant drag (responder claim test). */
export const isHorizontalSwipe = (dx: number, dy: number) =>
  Math.abs(dx) > SWIPE_CLAIM_DX && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE;

/** Fling direction on release, or null when the drag fell short. */
export const flingDirection = (dx: number): 'left' | 'right' | null =>
  dx <= -SWIPE_FLING_DX ? 'left' : dx >= SWIPE_FLING_DX ? 'right' : null;

type GestureLike = { dx: number; dy: number };

/**
 * PanResponder config for a horizontal fling area: claims only deliberate
 * horizontal drags, yields to other responders on request (nested scrolls),
 * and reports the fling direction on release. Spread into
 * `PanResponder.create(...)`.
 */
export const horizontalFlingResponderConfig = (onFling: (dir: 'left' | 'right') => void) => ({
  onMoveShouldSetPanResponder: (_evt: unknown, g: GestureLike) => isHorizontalSwipe(g.dx, g.dy),
  onPanResponderTerminationRequest: () => true,
  onPanResponderRelease: (_evt: unknown, g: GestureLike) => {
    const dir = flingDirection(g.dx);
    if (dir) onFling(dir);
  },
});
