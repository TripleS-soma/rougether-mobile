import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import {
  DarkThemes,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_MODE,
  type SemanticColors,
  type ThemeId,
  type ThemeMode,
  Themes,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ThemeControl = {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  /** Light/dark preference: 'system' follows the OS. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeControl>({
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
  mode: DEFAULT_THEME_MODE,
  setMode: () => {},
});

/** AsyncStorage key holding {themeId, mode} so the choice survives restarts. */
const STORAGE_KEY = 'rougether.theme';

/**
 * Holds the active brand theme (cozy / forest / hanok) and the light/dark mode
 * so the whole app re-tints when the settings pickers change them. Mounted
 * once at the app root; the saved choice is restored on launch.
 */
export function BrandThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as { themeId?: string; mode?: string };
        if (saved.themeId && saved.themeId in Themes) setThemeId(saved.themeId as ThemeId);
        if (saved.mode === 'system' || saved.mode === 'light' || saved.mode === 'dark')
          setMode(saved.mode);
      } catch {
        // Corrupt entry — fall back to defaults.
      }
    });
  }, []);

  const value = useMemo<ThemeControl>(() => {
    const persist = (next: { themeId: ThemeId; mode: ThemeMode }) =>
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    return {
      themeId,
      mode,
      setThemeId: (id) => {
        setThemeId(id);
        persist({ themeId: id, mode });
      },
      setMode: (m) => {
        setMode(m);
        persist({ themeId, mode: m });
      },
    };
  }, [themeId, mode]);
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
