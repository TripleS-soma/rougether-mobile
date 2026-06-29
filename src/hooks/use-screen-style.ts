import { useContext } from 'react';
import { type ViewStyle } from 'react-native';
import { type Edge, SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useTokens } from '@/hooks/use-tokens';

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
