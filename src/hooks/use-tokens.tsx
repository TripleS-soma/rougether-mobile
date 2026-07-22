import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import {
  type BrandFontId,
  DarkThemes,
  DEFAULT_FONT_ID,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_MODE,
  type EmphasisStyle,
  FONT_OPTIONS,
  fontEmphasis,
  type FontWeightKey,
  type SemanticColors,
  type ThemeId,
  type ThemeMode,
  Themes,
  type TypeRole,
  type TypeStyle,
  typographyFor,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ThemeControl = {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  /** Light/dark preference: 'system' follows the OS. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** App font choice (#382) — drives `useTypography()`. */
  fontId: BrandFontId;
  setFontId: (id: BrandFontId) => void;
};

const ThemeContext = createContext<ThemeControl>({
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
  mode: DEFAULT_THEME_MODE,
  setMode: () => {},
  fontId: DEFAULT_FONT_ID,
  setFontId: () => {},
});

/** AsyncStorage key holding {themeId, mode, fontId} so the choice survives restarts. */
const STORAGE_KEY = 'rougether.theme';

/**
 * Holds the active brand theme (cozy / forest / hanok) and the light/dark mode
 * so the whole app re-tints when the settings pickers change them. Mounted
 * once at the app root; the saved choice is restored on launch.
 */
export function BrandThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [fontId, setFontId] = useState<BrandFontId>(DEFAULT_FONT_ID);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as { themeId?: string; mode?: string; fontId?: string };
        if (saved.themeId && saved.themeId in Themes) setThemeId(saved.themeId as ThemeId);
        if (saved.mode === 'system' || saved.mode === 'light' || saved.mode === 'dark')
          setMode(saved.mode);
        if (FONT_OPTIONS.some((f) => f.id === saved.fontId)) setFontId(saved.fontId as BrandFontId);
      } catch {
        // Corrupt entry — fall back to defaults.
      }
    });
  }, []);

  const value = useMemo<ThemeControl>(() => {
    const persist = (next: { themeId: ThemeId; mode: ThemeMode; fontId: BrandFontId }) =>
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    return {
      themeId,
      mode,
      fontId,
      setThemeId: (id) => {
        setThemeId(id);
        persist({ themeId: id, mode, fontId });
      },
      setMode: (m) => {
        setMode(m);
        persist({ themeId, mode: m, fontId });
      },
      setFontId: (id) => {
        setFontId(id);
        persist({ themeId, mode, fontId: id });
      },
    };
  }, [themeId, mode, fontId]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Active brand theme id/mode + setters. Without a `BrandThemeProvider` ancestor
 * it resolves to the defaults ("cozy", system mode), so the dev gallery and
 * tests degrade safely.
 */
export function useBrandTheme(): ThemeControl {
  return useContext(ThemeContext);
}

/** The light/dark scheme in effect after applying the mode preference. */
export function useResolvedScheme(): 'light' | 'dark' {
  const { mode } = useContext(ThemeContext);
  const system = useColorScheme();
  if (mode !== 'system') return mode;
  return system === 'dark' ? 'dark' : 'light';
}

/** Active Rougether brand color tokens for the selected theme + mode. */
export function useTokens(): SemanticColors {
  const { themeId } = useContext(ThemeContext);
  const scheme = useResolvedScheme();
  return scheme === 'dark' ? DarkThemes[themeId] : Themes[themeId];
}

/**
 * The type scale for the selected app font (#382) — same roles/sizes as the
 * static `Typography`, with fontFamily resolved per role. Components shadow
 * the old import with `const Typography = useTypography()` so call sites stay
 * `Typography.body` etc.
 */
export function useTypography(): Record<TypeRole, TypeStyle> {
  const { fontId } = useContext(ThemeContext);
  return useMemo(() => typographyFor(fontId), [fontId]);
}

/**
 * Ad-hoc weight emphasis compatible with the active font: returns a
 * `fontWeight` for the system font, a family swap for custom fonts (which
 * must not take `fontWeight` — Android would fake-bold the real face).
 */
export function useFontEmphasis(): (weight: FontWeightKey) => EmphasisStyle {
  const { fontId } = useContext(ThemeContext);
  return useMemo(() => (weight: FontWeightKey) => fontEmphasis(fontId, weight), [fontId]);
}
