import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import {
  type BrandFontId,
  DarkThemes,
  DEFAULT_FONT_ID,
  DEFAULT_FONT_SIZE_ID,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_MODE,
  type EmphasisStyle,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  fontEmphasis,
  type FontSizeId,
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
  /** 글자 크기 단계 (설정 → 글씨) — `useTypography()`의 크기표를 고른다. */
  fontSizeId: FontSizeId;
  setFontSizeId: (id: FontSizeId) => void;
};

const ThemeContext = createContext<ThemeControl>({
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
  mode: DEFAULT_THEME_MODE,
  setMode: () => {},
  fontId: DEFAULT_FONT_ID,
  setFontId: () => {},
  fontSizeId: DEFAULT_FONT_SIZE_ID,
  setFontSizeId: () => {},
});

/** AsyncStorage key holding {themeId, mode, fontId, fontSizeId} so the choice survives restarts. */
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
  const [fontSizeId, setFontSizeId] = useState<FontSizeId>(DEFAULT_FONT_SIZE_ID);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as {
          themeId?: string;
          mode?: string;
          fontId?: string;
          fontSizeId?: string;
        };
        if (saved.themeId && saved.themeId in Themes) setThemeId(saved.themeId as ThemeId);
        if (saved.mode === 'system' || saved.mode === 'light' || saved.mode === 'dark')
          setMode(saved.mode);
        if (FONT_OPTIONS.some((f) => f.id === saved.fontId)) setFontId(saved.fontId as BrandFontId);
        // 크기를 고른 적 없는 기존 설치본은 값이 없다 — 기본 단계로 둔다.
        if (FONT_SIZE_OPTIONS.some((f) => f.id === saved.fontSizeId))
          setFontSizeId(saved.fontSizeId as FontSizeId);
      } catch {
        // Corrupt entry — fall back to defaults.
      }
    });
  }, []);

  const value = useMemo<ThemeControl>(() => {
    const persist = (next: {
      themeId: ThemeId;
      mode: ThemeMode;
      fontId: BrandFontId;
      fontSizeId: FontSizeId;
    }) => void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    return {
      themeId,
      mode,
      fontId,
      fontSizeId,
      setThemeId: (id) => {
        setThemeId(id);
        persist({ themeId: id, mode, fontId, fontSizeId });
      },
      setMode: (m) => {
        setMode(m);
        persist({ themeId, mode: m, fontId, fontSizeId });
      },
      setFontId: (id) => {
        setFontId(id);
        persist({ themeId, mode, fontId: id, fontSizeId });
      },
      setFontSizeId: (id) => {
        setFontSizeId(id);
        persist({ themeId, mode, fontId, fontSizeId: id });
      },
    };
  }, [themeId, mode, fontId, fontSizeId]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Overrides theme, font, and optionally color mode for a preview subtree.
 * Omitted values and setters are inherited from the parent.
 */
export function BrandThemePreview({
  themeId,
  fontId,
  fontSizeId,
  mode,
  children,
}: {
  themeId?: ThemeId;
  fontId?: BrandFontId;
  fontSizeId?: FontSizeId;
  mode?: ThemeMode;
  children: ReactNode;
}) {
  const parent = useContext(ThemeContext);
  const value = useMemo<ThemeControl>(
    () => ({
      ...parent,
      themeId: themeId ?? parent.themeId,
      fontId: fontId ?? parent.fontId,
      fontSizeId: fontSizeId ?? parent.fontSizeId,
      mode: mode ?? parent.mode,
    }),
    [parent, themeId, fontId, fontSizeId, mode],
  );
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
  const { fontId, fontSizeId } = useContext(ThemeContext);
  return useMemo(() => typographyFor(fontId, fontSizeId), [fontId, fontSizeId]);
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
