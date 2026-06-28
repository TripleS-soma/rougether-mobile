import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Rougether brand design tokens — semantic color roles ported from the web
 * prototype's design system (`rougether-prototype/src/app/design-system/theme.ts`).
 * Use these for ported product screens (via `useTokens()`); the neutral `Colors`
 * above stay for the Expo template's own chrome until those screens migrate.
 */
export type ThemeId = 'cozy' | 'forest' | 'hanok';

export type SemanticColors = {
  /** App-shell background behind the screen (safe-area edges, gutters). */
  appShell: string;
  /** Default screen background. */
  screen: string;
  /** Raised surface — cards, sheets, headers. */
  surface: string;
  /** Subtle filled surface — muted rows, chips. */
  surfaceMuted: string;
  /** Hairline borders / dividers. */
  border: string;
  /** Primary text. */
  text: string;
  /** Secondary / muted text. */
  textMuted: string;
  /** Brand accent — primary buttons, active states. */
  primary: string;
  /** Pressed/active variant of `primary`. */
  primaryActive: string;
  /** Text/icon on top of `primary`. */
  onPrimary: string;
};

export const Themes: Record<ThemeId, SemanticColors> = {
  cozy: {
    appShell: '#E8DCC8',
    screen: '#FBF8F3',
    surface: '#FFFFFF',
    surfaceMuted: '#F5F1E8',
    border: '#E8DCC8',
    text: '#4A403A',
    textMuted: '#8B7E74',
    primary: '#7FA87F',
    primaryActive: '#6D926D',
    onPrimary: '#FFFFFF',
  },
  forest: {
    appShell: '#DCE8D0',
    screen: '#F6FAF1',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF5E7',
    border: '#CFE0C3',
    text: '#334236',
    textMuted: '#667563',
    primary: '#5F9B6A',
    primaryActive: '#4D8657',
    onPrimary: '#FFFFFF',
  },
  hanok: {
    appShell: '#D8C8AF',
    screen: '#FAF5EA',
    surface: '#FFFDF8',
    surfaceMuted: '#F2E8D7',
    border: '#D9C5A4',
    text: '#493B2E',
    textMuted: '#7F6E5E',
    primary: '#9A7B4F',
    primaryActive: '#83663F',
    onPrimary: '#FFFFFF',
  },
};

/** Prototype default is "cozy" (포근). Theme switching arrives with the settings screen. */
export const DEFAULT_THEME_ID: ThemeId = 'cozy';

/** Corner-radius scale (prototype cards use ~16px / rounded-2xl). */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;
