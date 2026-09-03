import { Spacing } from '@/constants/theme';

/**
 * 떠 있는 하단 액션 바(#1069)의 치수 — 바(그리는 쪽)와 스크롤 화면(밑으로
 * 지나가는 콘텐츠의 하단 패딩)이 같은 숫자를 본다. 단일 버튼 한 줄 기준.
 */

/** 버튼 한 줄 높이 — 라벨(≈22) + 상하 패딩 16·16. */
export const ACTION_BAR_HEIGHT = 54;

/** 바 아래 가장자리에서 화면 바닥까지 — 바텀바 알약(bottom-nav-geometry)과 같은 규칙. */
export function actionBarBottomOffset(insetBottom: number): number {
  return Math.max(insetBottom + Spacing.one, Spacing.three);
}

/** 떠 있는 바 밑으로 지나가는 스크롤 콘텐츠가 가져야 할 하단 패딩. */
export function actionBarUnderlapInset(insetBottom: number): number {
  return actionBarBottomOffset(insetBottom) + ACTION_BAR_HEIGHT + Spacing.three;
}
