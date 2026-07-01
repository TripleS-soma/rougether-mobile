import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import { DEFAULT_THEME_ID, type SemanticColors, type ThemeId, Themes } from '@/constants/theme';

type ThemeControl = { themeId: ThemeId; setThemeId: (id: ThemeId) => void };

const ThemeContext = createContext<ThemeControl>({
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
});

/**
 * Holds the active brand theme (cozy / forest / hanok) so the whole app re-tints
 * when the settings theme picker changes it. Mounted once at the app root.
 */
export function BrandThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const value = useMemo(() => ({ themeId, setThemeId }), [themeId]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Active brand theme id + setter. Without a `BrandThemeProvider` ancestor it
 * resolves to the default ("cozy") theme, so the dev gallery and tests degrade
 * safely.
 */
export function useBrandTheme(): ThemeControl {
  return useContext(ThemeContext);
}

/** Active Rougether brand color tokens for the selected theme. */
export function useTokens(): SemanticColors {
  const { themeId } = useContext(ThemeContext);
  return Themes[themeId];
}
