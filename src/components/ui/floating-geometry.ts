import { Spacing } from '@/constants/theme';

/**
 * 화면 바닥에 떠 있는 요소(알약 바텀바 #1049, 하단 액션 바 #1069)의 공용 치수.
 */

/**
 * 떠 있는 요소의 아래 가장자리에서 화면 바닥까지 — 홈 인디케이터 위에 살짝 띄우고,
 * 인셋이 없는 기기(홈 버튼)에서는 최소 여백을 보장한다.
 */
export function floatingBottomOffset(insetBottom: number): number {
  return Math.max(insetBottom + Spacing.one, Spacing.three);
}
