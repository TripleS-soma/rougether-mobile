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
 * Rougether brand design tokens — semantic color roles. Values keep the warm
 * prototype brand (cozy/forest/hanok); the token *structure* follows the
 * Astryx design-system standard (facebook/astryx) — semantic names mapped to
 * background / text / accent / border / status roles. Astryx itself is web-only
 * (React + StyleX), so we mirror its standard, not its code. Astryx role names
 * are noted per token. Use via `useTokens()`; the neutral template `Colors`
 * above stay for the Expo template chrome until screens migrate.
 */
export type ThemeId = 'cozy' | 'forest' | 'hanok';

export type SemanticColors = {
  /** App-shell background behind the screen (safe-area edges, gutters). */
  appShell: string;
  /** Default screen background. Astryx: `background-body`. */
  screen: string;
  /** Raised surface — sheets, headers, inputs. Astryx: `background-surface`. */
  surface: string;
  /** Elevated container. Astryx: `background-card`. */
  card: string;
  /** Subtle filled surface — muted rows, chips. Astryx: `background-muted`. */
  surfaceMuted: string;
  /** Hairline borders / dividers. Astryx: `border`. */
  border: string;
  /** Primary text. Astryx: `text-primary`. */
  text: string;
  /** Secondary / muted text. Astryx: `text-secondary`. */
  textMuted: string;
  /** Disabled text. Astryx: `text-disabled`. */
  textDisabled: string;
  /** Default icon color. Astryx: `icon`. */
  icon: string;
  /** Brand accent — primary buttons, active states. Astryx: `accent`. */
  primary: string;
  /** Pressed/active variant of `primary`. */
  primaryActive: string;
  /** Text/icon on top of `primary`. Astryx: `on-accent`. */
  onPrimary: string;
  /**
   * Brand-hued text/labels sitting on surfaces (active tabs, links, "＋ 만들기").
   * AA-darkened variant of `primary` — `primary` itself is a fill color and
   * falls short of 4.5:1 as text on light backgrounds.
   */
  primaryText: string;
  /**
   * Ink on fixed light tint surfaces (pastel room tiles, colored chips whose
   * background does NOT follow the theme). Stays dark in dark mode — `text`
   * flips light there and disappears against the unchanged pastel.
   */
  onTint: string;
  /** Status — positive. Astryx categorical green. */
  success: string;
  /** Status — caution. Astryx categorical orange/yellow. */
  warning: string;
  /** Warning-hued text on surfaces (스트릭 "N일", 타이머) — AA variant of `warning`. */
  warningText: string;
  /** Status — negative. Astryx categorical red. */
  danger: string;
  /** Background of disabled buttons/controls (text on it: `onPrimary`/`textMuted`). */
  disabledBg: string;
  /** 집 화면 야외 배경 — 프레임 뒤 하늘 (#287). 커버와 무관한 고정 톤. */
  sky: string;
  /** 집 화면 야외 배경 — 프레임 아래 잔디 밴드 (#287). */
  grass: string;
};

export const Themes: Record<ThemeId, SemanticColors> = {
  cozy: {
    appShell: '#E8DCC8',
    screen: '#FBF8F3',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    surfaceMuted: '#F5F1E8',
    border: '#E8DCC8',
    text: '#4A403A',
    textMuted: '#8B7E74',
    textDisabled: '#B5A89C',
    icon: '#8B7E74',
    primary: '#7FA87F',
    primaryActive: '#6D926D',
    onPrimary: '#2D2623',
    primaryText: '#517751',
    onTint: '#4A403A',
    success: '#5F9B6A',
    warning: '#E8A24A',
    warningText: '#9D6014',
    danger: '#D67878',
    disabledBg: '#D9D2C5',
    sky: '#C3E0F5',
    grass: '#B5D89A',
  },
  forest: {
    appShell: '#DCE8D0',
    screen: '#F6FAF1',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    surfaceMuted: '#EEF5E7',
    border: '#CFE0C3',
    text: '#334236',
    textMuted: '#667563',
    textDisabled: '#9DAE97',
    icon: '#667563',
    primary: '#5F9B6A',
    primaryActive: '#4D8657',
    onPrimary: '#202A22',
    primaryText: '#4A7953',
    onTint: '#334236',
    success: '#5F9B6A',
    warning: '#E8A24A',
    warningText: '#9D6014',
    danger: '#D67878',
    disabledBg: '#CBD8C4',
    sky: '#C3E0F5',
    grass: '#B5D89A',
  },
  hanok: {
    appShell: '#D8C8AF',
    screen: '#FAF5EA',
    surface: '#FFFDF8',
    card: '#FFFDF8',
    surfaceMuted: '#F2E8D7',
    border: '#D9C5A4',
    text: '#493B2E',
    textMuted: '#7F6E5E',
    textDisabled: '#A99B86',
    icon: '#7F6E5E',
    primary: '#9A7B4F',
    primaryActive: '#83663F',
    onPrimary: '#1C1712',
    primaryText: '#7F6541',
    onTint: '#493B2E',
    success: '#7E9A6A',
    warning: '#C9943F',
    warningText: '#886226',
    danger: '#C77A6A',
    disabledBg: '#DCCFB9',
    sky: '#C3E0F5',
    grass: '#B5D89A',
  },
};

/**
 * Dark variants of the brand themes — same semantic roles, same hue identity
 * per theme (cozy warm-brown, forest green, hanok tan), tuned for dark
 * surfaces: darker warm backgrounds, lightened text, brightened accents with
 * dark on-accent text for contrast.
 */
export const DarkThemes: Record<ThemeId, SemanticColors> = {
  cozy: {
    appShell: '#171310',
    screen: '#211C16',
    surface: '#2B251E',
    card: '#2B251E',
    surfaceMuted: '#362F26',
    border: '#453C31',
    text: '#EFE7DA',
    textMuted: '#B5A99A',
    textDisabled: '#7C7264',
    icon: '#B5A99A',
    primary: '#93BE93',
    primaryActive: '#7FA87F',
    onPrimary: '#1E2A1E',
    // Bright accents already clear 4.5:1 as text on the dark surfaces.
    primaryText: '#93BE93',
    onTint: '#4A403A',
    success: '#7CB98A',
    warning: '#EDB061',
    warningText: '#EDB061',
    danger: '#E08D8D',
    disabledBg: '#3D362C',
    sky: '#2A3448',
    grass: '#33422E',
  },
  forest: {
    appShell: '#101711',
    screen: '#18211A',
    surface: '#212D23',
    card: '#212D23',
    surfaceMuted: '#2A382C',
    border: '#3A473B',
    text: '#E2EBE1',
    textMuted: '#A3B2A0',
    textDisabled: '#6E7D6B',
    icon: '#A3B2A0',
    primary: '#7FBC8B',
    primaryActive: '#6BAA78',
    onPrimary: '#14251A',
    primaryText: '#7FBC8B',
    onTint: '#334236',
    success: '#7CB98A',
    warning: '#EDB061',
    warningText: '#EDB061',
    danger: '#E08D8D',
    disabledBg: '#32402F',
    sky: '#2A3448',
    grass: '#33422E',
  },
  hanok: {
    appShell: '#1A150D',
    screen: '#241E13',
    surface: '#2F271A',
    card: '#2F271A',
    surfaceMuted: '#3A3122',
    border: '#4E4230',
    text: '#F0E7D7',
    textMuted: '#BCAD97',
    textDisabled: '#83765F',
    icon: '#BCAD97',
    primary: '#C4A16F',
    primaryActive: '#B08D5B',
    onPrimary: '#2A2113',
    primaryText: '#C4A16F',
    onTint: '#493B2E',
    success: '#96B37F',
    warning: '#DCA855',
    warningText: '#DCA855',
    danger: '#DA9384',
    disabledBg: '#453A28',
    sky: '#2A3448',
    grass: '#33422E',
  },
};

/** Prototype default is "cozy" (포근). Theme switching arrives with the settings screen. */
export const DEFAULT_THEME_ID: ThemeId = 'cozy';

/** Light/dark mode preference: follow the OS, or force one. */
export type ThemeMode = 'system' | 'light' | 'dark';
export const DEFAULT_THEME_MODE: ThemeMode = 'system';

/** Corner-radius scale (prototype cards use ~16px / rounded-2xl). */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

// ---------- 시간대별 하늘 (#358) ----------

/** 집 화면 하늘의 하루 국면 — 기기 시각 기준. */
export type SkyPhase = 'dawn' | 'day' | 'sunset' | 'night';

/** 현재 시(0~23) → 하늘 국면. 새벽 05–08 / 낮 08–17 / 노을 17–20 / 밤 20–05. */
export function skyPhaseForHour(hour: number): SkyPhase {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'sunset';
  return 'night';
}

/**
 * 시간대별 하늘색 — 라이트/다크 각각. day는 기존 sky 토큰과 동일 값이라
 * 낮 시간의 모습은 종전과 같다.
 */
/** 비 오는 날 하늘 (#360) — 시간대 색 위에 우선하는 흐린 회톤. */
export const RAIN_SKY: Record<'light' | 'dark', string> = {
  light: '#A9B3C2',
  dark: '#222834',
};

export const SKY_BY_PHASE: Record<'light' | 'dark', Record<SkyPhase, string>> = {
  light: {
    dawn: '#DCD6EC',
    day: '#C3E0F5',
    sunset: '#F6CDAB',
    night: '#3E4A6B',
  },
  dark: {
    dawn: '#33324A',
    day: '#2A3448',
    sunset: '#463527',
    night: '#1E2536',
  },
};

/**
 * Font weights. Astryx scale: normal / medium / semibold / bold.
 * String values are what React Native's `fontWeight` expects.
 */
export const FontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type TypeRole =
  'display1' | 'display2' | 'h1' | 'h2' | 'h3' | 'large' | 'body' | 'label' | 'supporting' | 'code';

export type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: (typeof FontWeight)[keyof typeof FontWeight];
};

/**
 * Type scale, following the Astryx standard: named roles built on a modular
 * scale (base ≈ 16, ratio ≈ 1.2; nudged to clean values for mobile). Pair with
 * a color via tokens, e.g. `<Text style={[Typography.body, { color: t.text }]}>`.
 */
export const Typography: Record<TypeRole, TypeStyle> = {
  display1: { fontSize: 34, lineHeight: 40, fontWeight: FontWeight.bold },
  display2: { fontSize: 28, lineHeight: 34, fontWeight: FontWeight.bold },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: FontWeight.bold },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: FontWeight.bold },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: FontWeight.semibold },
  large: { fontSize: 18, lineHeight: 26, fontWeight: FontWeight.medium },
  body: { fontSize: 16, lineHeight: 24, fontWeight: FontWeight.normal },
  label: { fontSize: 14, lineHeight: 20, fontWeight: FontWeight.semibold },
  supporting: { fontSize: 12, lineHeight: 16, fontWeight: FontWeight.normal },
  code: { fontSize: 13, lineHeight: 18, fontWeight: FontWeight.medium },
};
