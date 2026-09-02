import { Spacing } from '@/constants/theme';

/**
 * 떠 있는 알약 바텀바의 치수 (#1049) — 바텀바(그리는 쪽)와 스크롤 화면(밑으로
 * 지나가는 콘텐츠의 하단 패딩)이 같은 숫자를 봐야 해서 한 곳에 둔다.
 * 측정(onLayout)으로 알리면 셸이 한 번 더 렌더되므로 상수로 계산한다.
 */

/** 알약 안쪽 상하 패딩. */
export const NAV_PILL_PAD_V = Spacing.two;
/** 알약 안쪽 좌우 패딩. */
export const NAV_PILL_PAD_H = Spacing.two;
/** 탭 아이콘 한 변. */
export const NAV_ICON_SIZE = 24;
/** 아이콘과 라벨 사이. */
export const NAV_ICON_LABEL_GAP = Spacing.half;

/** 알약 높이 — 라벨 줄높이는 선택 폰트에 따라 달라 인자로 받는다. */
export function navPillHeight(labelLineHeight: number): number {
  return NAV_PILL_PAD_V * 2 + NAV_ICON_SIZE + NAV_ICON_LABEL_GAP + labelLineHeight;
}

/**
 * 알약 아래 가장자리에서 화면 바닥까지 — 홈 인디케이터 위에 살짝 띄우고,
 * 인셋이 없는 기기(홈 버튼)에서는 최소 여백을 보장한다.
 */
export function navPillBottomOffset(insetBottom: number): number {
  return Math.max(insetBottom + Spacing.one, Spacing.three);
}

/** 알약 밑으로 지나가는 스크롤 콘텐츠가 가져야 할 하단 패딩. */
export function navUnderlapInset(insetBottom: number, labelLineHeight: number): number {
  return navPillBottomOffset(insetBottom) + navPillHeight(labelLineHeight) + Spacing.three;
}
