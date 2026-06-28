import { DEFAULT_THEME_ID, Themes, type SemanticColors } from '@/constants/theme';

/**
 * Active Rougether brand tokens. Returns the default ("cozy") theme for now;
 * when the settings screen adds theme switching, wire the selected ThemeId
 * through here so call sites stay unchanged.
 */
export function useTokens(): SemanticColors {
  return Themes[DEFAULT_THEME_ID];
}
