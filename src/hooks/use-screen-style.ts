import { useContext } from 'react';
import { type ViewStyle } from 'react-native';
import { type Edge, SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { actionBarUnderlapInset } from '@/components/ui/action-bar-geometry';
import { navUnderlapInset } from '@/components/ui/bottom-nav-geometry';
import { headerUnderlapInset } from '@/components/ui/screen-header-geometry';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

const ZERO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Common screen container style: the active screen background token plus
 * safe-area inset padding on the requested edges. Use it on a full-screen
 * route's root so headers / bottom action bars clear the notch, status bar, and
 * home indicator. Defaults to the top edge (most screens have a header); pass
 * `['top', 'bottom']` when the screen has a pinned bottom action bar.
 *
 * Requires a `SafeAreaProvider` ancestor (mounted at the app root); without one
 * insets resolve to 0, so it degrades safely in the dev gallery and tests.
 */
export function useScreenStyle(edges: Edge[] = ['top']): ViewStyle {
  const t = useTokens();
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  return {
    backgroundColor: t.screen,
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };
}

/**
 * Header top padding that extends the header's own background color under the
 * status bar, so the status bar and header read as one bar. Use on screens
 * whose header is a colored bar (t.surface): switch the root to
 * `useScreenStyle([])` (so the root doesn't also pad the top) and append this
 * AFTER the header's base style — it only overrides paddingTop
 * (inset + the header's usual vertical padding).
 */
export function useHeaderInsetStyle(basePadding: number = Spacing.three): ViewStyle {
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  return { paddingTop: insets.top + basePadding };
}

/**
 * 바텀바 밑으로 지나가는 스크롤 콘텐츠의 추가 하단 패딩 (#1049). 리퀴드
 * 글래스 알약이 떠 있을 때만 0이 아니다 — 그때 바텀바는 오버레이라 레이아웃
 * 높이가 없고, 마지막 항목이 알약에 가려지지 않으려면 콘텐츠가 이만큼 더
 * 내려가야 한다. 불투명 바(폴백)는 flex 형제라 0.
 * 하단 탭 3서피스(나의 방·집·설정)의 contentContainerStyle에 더한다.
 */
export function useBottomNavInset(): number {
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  const Typography = useTypography();
  return navUnderlapInset(insets.bottom, Typography.supporting.lineHeight);
}

/**
 * 떠 있는 헤더(#1069) 밑으로 지나가는 스크롤 콘텐츠의 추가 상단 패딩. 리퀴드
 * 글래스 헤더가 오버레이일 때만 0이 아니다 — 폴백의 불투명 헤더 바는 flex
 * 형제라 0. `ScreenHeader`를 쓰는 화면의 contentContainerStyle 맨 앞 패딩에 더한다.
 */
export function useHeaderContentInset(): number {
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  return headerUnderlapInset(insets.top);
}

/**
 * 떠 있는 하단 액션 바(#1069, `ui/action-bar`) 밑으로 지나가는 스크롤 콘텐츠의 추가
 * 하단 패딩. 글래스 모드에서만 0이 아니다 — 폴백 바는 flex 형제라 0.
 */
export function useActionBarInset(): number {
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  return actionBarUnderlapInset(insets.bottom);
}
