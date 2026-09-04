import { Spacing } from '@/constants/theme';

/**
 * 떠 있는 헤더(#1069)의 치수 — 헤더(그리는 쪽)와 스크롤 화면(밑으로 지나가는
 * 콘텐츠의 상단 패딩)이 같은 숫자를 봐야 해서 한 곳에 둔다. 바텀바의
 * bottom-nav-geometry와 같은 이유.
 */

/** 뒤로가기 원·제목 알약의 높이. */
export const HEADER_ROW_HEIGHT = 44;
/** 상태바 아래 여백 — 나의 방 크롬(#1055)과 같은 값. */
export const HEADER_TOP_GAP = Spacing.two;

/** 떠 있는 헤더 밑으로 지나가는 스크롤 콘텐츠가 가져야 할 상단 패딩. */
export function headerUnderlapInset(insetTop: number): number {
  return insetTop + HEADER_TOP_GAP + HEADER_ROW_HEIGHT + Spacing.three;
}
