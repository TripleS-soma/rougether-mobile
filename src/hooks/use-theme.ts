/**
 * Template light/dark chrome colors (tab bar, nav). Follows the resolved
 * scheme from the brand theme provider, so the 다크 모드 setting overrides
 * the OS scheme here too.
 */

import { Colors } from '@/constants/theme';
import { useResolvedScheme } from '@/hooks/use-tokens';

export function useTheme() {
  return Colors[useResolvedScheme()];
}
