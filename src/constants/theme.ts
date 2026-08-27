import '@/global.css';

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

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Rougether brand design tokens — semantic color roles. Values keep the warm
 * prototype brand (cozy/forest/hanok); the token *structure* follows the
 * Astryx design-system standard (facebook/astryx) — semantic names mapped to
 * background / text / accent / border / status roles. Astryx itself is web-only
 * (React + StyleX), so we mirror its standard, not its code. Astryx role names
 * are noted per token. Use via `useTokens()`; the neutral template `Colors`
 * above stay for the Expo template chrome until screens migrate.
 */
export type ThemeId = 'cozy' | 'forest' | 'hanok' | 'latte' | 'citrus' | 'pastel' | 'indigo';

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
  /** Soft tint of `primary` (8-digit hex, ~13% alpha) — selected chips, owner badges. */
  primarySoft: string;
  /** Soft tint of `warning` — notice/banner backgrounds. */
  warningSoft: string;
  /** Soft tint of `danger` — destructive-action backgrounds (삭제/나가기). */
  dangerSoft: string;
  /**
   * `danger`의 **본문 텍스트용** 변종 (#900). `danger`는 채움·테두리를 겨냥해
   * 밝게 잡혀 있어 흰 배경 위 글자로 쓰면 3.1:1로 AA(4.5:1)에 못 미친다.
   * 색상은 그대로 두고 명도만 낮춰 라이트 서피스 전체에서 5:1을 넘긴다.
   * 다크에서는 `danger`가 이미 6:1이라 같은 값을 쓴다 (warningText와 같은 결).
   */
  dangerText: string;
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
    primarySoft: '#7FA87F22',
    warningSoft: '#E8A24A22',
    dangerSoft: '#D6787822',
    dangerText: '#C43D3D',
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
    primarySoft: '#5F9B6A22',
    warningSoft: '#E8A24A22',
    dangerSoft: '#D6787822',
    dangerText: '#C43D3D',
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
    primarySoft: '#9A7B4F22',
    warningSoft: '#C9943F22',
    dangerSoft: '#C77A6A22',
    dangerText: '#AD5341',
    disabledBg: '#DCCFB9',
    sky: '#C3E0F5',
    grass: '#B5D89A',
  },
  // 신규 4종 (#459) — 각 primary hue로 중립까지 저채도 틴트(forest/hanok와 같은
  // 방식). onPrimary/primaryText는 대비 4.5:1로 파생. sky/grass는 고정 유지.
  latte: {
    appShell: '#E3D6C9',
    screen: '#FAF7F5',
    surface: '#FDFCFC',
    card: '#FDFCFC',
    surfaceMuted: '#F3EDE7',
    border: '#E3D9CF',
    text: '#463B2F',
    textMuted: '#867565',
    textDisabled: '#B3A89E',
    icon: '#867565',
    primary: '#DDB287',
    primaryActive: '#C79E73',
    onPrimary: '#2D2623',
    primaryText: '#8A6A49',
    onTint: '#463B2F',
    success: '#5F9B6A',
    warning: '#E8A24A',
    warningText: '#9D6014',
    danger: '#D67878',
    primarySoft: '#DDB28722',
    warningSoft: '#E8A24A22',
    dangerSoft: '#D6787822',
    dangerText: '#C43D3D',
    disabledBg: '#D6CCC2',
    sky: '#C3E0F5',
    grass: '#B5D89A',
  },
  citrus: {
    appShell: '#D9E3C9',
    screen: '#F8FAF5',
    surface: '#FDFDFC',
    card: '#FDFDFC',
    surfaceMuted: '#EEF3E7',
    border: '#DBE3CF',
    text: '#3D462F',
    textMuted: '#798665',
    textDisabled: '#AAB39E',
    icon: '#798665',
    primary: '#B5D086',
    primaryActive: '#9FBC6E',
    onPrimary: '#2D2623',
    primaryText: '#5D7C2E',
    onTint: '#3D462F',
    success: '#5F9B6A',
    warning: '#E8A24A',
    warningText: '#9D6014',
    danger: '#D67878',
    primarySoft: '#B5D08622',
    warningSoft: '#E8A24A22',
    dangerSoft: '#D6787822',
    dangerText: '#C43D3D',
    disabledBg: '#CED6C2',
    sky: '#C3E0F5',
    grass: '#B5D89A',
  },
  pastel: {
    appShell: '#E3CDC9',
    screen: '#FAF6F5',
    surface: '#FDFCFC',
    card: '#FDFCFC',
    surfaceMuted: '#F3E9E7',
    border: '#E3D1CF',
    text: '#46322F',
    textMuted: '#866965',
    textDisabled: '#B3A19E',
    icon: '#866965',
    primary: '#F79B8D',
    primaryActive: '#D9887C',
    onPrimary: '#2D2623',
    primaryText: '#9B6259',
    onTint: '#46322F',
    success: '#5F9B6A',
    warning: '#E8A24A',
    warningText: '#9D6014',
    danger: '#D67878',
    primarySoft: '#F79B8D22',
    warningSoft: '#E8A24A22',
    dangerSoft: '#D6787822',
    dangerText: '#C43D3D',
    disabledBg: '#D6C4C2',
    sky: '#C3E0F5',
    grass: '#B5D89A',
  },
  indigo: {
    appShell: '#C9DCE3',
    screen: '#F5F8FA',
    surface: '#FCFDFD',
    card: '#FCFDFD',
    surfaceMuted: '#E7F0F3',
    border: '#CFDDE3',
    text: '#2F3F46',
    textMuted: '#657C86',
    textDisabled: '#9EADB3',
    icon: '#657C86',
    primary: '#7FC2DE',
    primaryActive: '#67AECD',
    onPrimary: '#2D2623',
    primaryText: '#0C79A6',
    onTint: '#2F3F46',
    success: '#5F9B6A',
    warning: '#E8A24A',
    warningText: '#9D6014',
    danger: '#D67878',
    primarySoft: '#7FC2DE22',
    warningSoft: '#E8A24A22',
    dangerSoft: '#D6787822',
    dangerText: '#C43D3D',
    disabledBg: '#C2D0D6',
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
/**
 * 다크 공통 중립 (#755) — 다크 모드 배경은 테마와 무관하게 cozy의 웜 브라운
 * 바탕 하나로 통일한다. 사용자 피드백: "다크에서 색상 따라 배경까지 바뀌는 건
 * 아니다" — 다크에서 테마는 액센트(primary 계열)로만 드러난다. 스플래시
 * 다크(밤 씬, #569)와도 이 바탕이 이어진다.
 */
const DarkNeutrals = {
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
  disabledBg: '#3D362C',
  sky: '#2A3448',
  grass: '#33422E',
} as const;

export const DarkThemes: Record<ThemeId, SemanticColors> = {
  cozy: {
    ...DarkNeutrals,
    // 고정 파스텔 타일 잉크 — 다크에서도 라이트 text와 동일 (통일 대상 아님).
    onTint: '#4A403A',
    primary: '#93BE93',
    primaryActive: '#7FA87F',
    onPrimary: '#1E2A1E',
    primaryText: '#93BE93',
    primarySoft: '#93BE9322',
    success: '#7CB98A',
    warning: '#EDB061',
    warningText: '#EDB061',
    danger: '#E08D8D',
    warningSoft: '#EDB06122',
    dangerSoft: '#E08D8D22',
    dangerText: '#E08D8D',
  },
  forest: {
    ...DarkNeutrals,
    // 고정 파스텔 타일 잉크 — 다크에서도 라이트 text와 동일 (통일 대상 아님).
    onTint: '#334236',
    primary: '#7FBC8B',
    primaryActive: '#6BAA78',
    onPrimary: '#14251A',
    primaryText: '#7FBC8B',
    primarySoft: '#7FBC8B22',
    success: '#7CB98A',
    warning: '#EDB061',
    warningText: '#EDB061',
    danger: '#E08D8D',
    warningSoft: '#EDB06122',
    dangerSoft: '#E08D8D22',
    dangerText: '#E08D8D',
  },
  hanok: {
    ...DarkNeutrals,
    // 고정 파스텔 타일 잉크 — 다크에서도 라이트 text와 동일 (통일 대상 아님).
    onTint: '#493B2E',
    primary: '#C4A16F',
    primaryActive: '#B08D5B',
    onPrimary: '#2A2113',
    primaryText: '#C4A16F',
    primarySoft: '#C4A16F22',
    success: '#96B37F',
    warning: '#DCA855',
    warningText: '#DCA855',
    danger: '#DA9384',
    warningSoft: '#DCA85522',
    dangerSoft: '#DA938422',
    dangerText: '#DA9384',
  },
  // 신규 4종 다크 (#459) — 라이트와 같은 hue, 다크 표면 위로 primary를 밝혀
  // primaryText로 그대로 쓴다(대비 통과). (#755 이전엔 primaryActive가 라이트
  // primary값이었으나, 라이트 액센트가 파스텔로 옮겨가며 그 등식은 풀렸다.)
  latte: {
    ...DarkNeutrals,
    // 고정 파스텔 타일 잉크 — 다크에서도 라이트 text와 동일 (통일 대상 아님).
    onTint: '#463B2F',
    primary: '#C4A07B',
    primaryActive: '#B98E62',
    onPrimary: '#2D2623',
    primaryText: '#C4A07B',
    primarySoft: '#C4A07B22',
    success: '#7CB98A',
    warning: '#EDB061',
    warningText: '#EDB061',
    danger: '#E08D8D',
    warningSoft: '#EDB06122',
    dangerSoft: '#E08D8D22',
    dangerText: '#E08D8D',
  },
  citrus: {
    ...DarkNeutrals,
    // 고정 파스텔 타일 잉크 — 다크에서도 라이트 text와 동일 (통일 대상 아님).
    onTint: '#3D462F',
    primary: '#93B65D',
    primaryActive: '#7EA83E',
    onPrimary: '#2D2623',
    primaryText: '#93B65D',
    primarySoft: '#93B65D22',
    success: '#7CB98A',
    warning: '#EDB061',
    warningText: '#EDB061',
    danger: '#E08D8D',
    warningSoft: '#EDB06122',
    dangerSoft: '#E08D8D22',
    dangerText: '#E08D8D',
  },
  pastel: {
    ...DarkNeutrals,
    // 고정 파스텔 타일 잉크 — 다크에서도 라이트 text와 동일 (통일 대상 아님).
    onTint: '#46322F',
    primary: '#F8AB9F',
    primaryActive: '#F79B8D',
    onPrimary: '#2D2623',
    primaryText: '#F8AB9F',
    primarySoft: '#F8AB9F22',
    success: '#7CB98A',
    warning: '#EDB061',
    warningText: '#EDB061',
    danger: '#E08D8D',
    warningSoft: '#EDB06122',
    dangerSoft: '#E08D8D22',
    dangerText: '#E08D8D',
  },
  indigo: {
    ...DarkNeutrals,
    // 고정 파스텔 타일 잉크 — 다크에서도 라이트 text와 동일 (통일 대상 아님).
    onTint: '#2F3F46',
    primary: '#65B2D2',
    primaryActive: '#0E86B8',
    onPrimary: '#2D2623',
    primaryText: '#65B2D2',
    primarySoft: '#65B2D222',
    success: '#7CB98A',
    warning: '#EDB061',
    warningText: '#EDB061',
    danger: '#E08D8D',
    warningSoft: '#EDB06122',
    dangerSoft: '#E08D8D22',
    dangerText: '#E08D8D',
  },
};

/** Prototype default is "cozy" (포근). Theme switching arrives with the settings screen. */
export const DEFAULT_THEME_ID: ThemeId = 'cozy';

/**
 * Brand themes offered in the settings 테마 색상 picker (#459), in display order.
 * `swatch` is the theme's light `primary` — the dot shown in the picker. Legacy
 * `forest`/`hanok` stay defined in `Themes` (so any persisted id still resolves)
 * but are intentionally omitted here.
 */
export type ThemeOption = { id: ThemeId; name: string; swatch: string };
export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'cozy', name: '포근', swatch: '#7FA87F' },
  { id: 'latte', name: '라떼', swatch: '#DDB287' },
  { id: 'citrus', name: '시트러스 그로브', swatch: '#B5D086' },
  { id: 'pastel', name: '파스텔 캔디', swatch: '#F79B8D' },
  { id: 'indigo', name: '인디고 타이드', swatch: '#7FC2DE' },
];

/** Light/dark mode preference: follow the OS, or force one. */
export type ThemeMode = 'system' | 'light' | 'dark';
export const DEFAULT_THEME_MODE: ThemeMode = 'system';

/** Corner-radius scale (prototype cards use ~16px / rounded-2xl). */
/**
 * Fixed white for marks/text on colored fills and dark scrims (category-color
 * check marks, overlay captions). Theme-independent — `onPrimary` is dark ink
 * on the pastel primaries, not white.
 */
export const StaticWhite = '#FFFFFF';

/**
 * 고정 아트 위에 얹는 반투명 색 — 테마 독립 (#781). 방 격자 가이드는 나무
 * 바닥 위, 하늘 필은 고정 하늘 아트 위라 테마 토큰을 쓰면 대비가 무너진다.
 */
export const FixedOverlay = {
  /** 꾸미기 격자 가이드 선 (#327). */
  gridLine: 'rgba(80,66,55,0.55)',
  /** 격자 셀 테두리 — 선보다 옅게. */
  gridCell: 'rgba(80,66,55,0.35)',
  /** 격자 셀 채움 — 바닥이 비쳐야 해서 아주 옅게. */
  gridFill: 'rgba(255,255,255,0.18)',
  /** 하늘 위 정보 필(Lv·멤버 수) 배경 (#287). */
  skyPill: 'rgba(255,255,255,0.88)',
} as const;

/**
 * 그림자 색 — 테마 독립. 다크에서도 검정을 쓴다(밝은 색 그림자는 광원이
 * 반대라는 뜻이 되어 어색하다). 화면마다 '#000'을 박던 것을 한 곳으로 (#781).
 */
export const ShadowColor = '#000000';

/**
 * Animated splash overlay backgrounds — MUST match the expo-splash-screen
 * `backgroundColor`(light/dark) in app.json, or the native → JS splash
 * handoff flashes (#569). 라이트는 스플래시 아트의 크림, 다크는 밤 씬 남색.
 */
export const SplashBackground = '#FEF1D6';
export const SplashBackgroundDark = '#243273';

/** Dim scrims behind sheets/dialogs/full-screen overlays — theme-independent. */
/**
 * 태블릿·큰 화면 콘텐츠 컬럼 상한 (#725). 화면들이 폰 폭(≈390)을 전제로
 * 그려져 있어, 이 상한이 없으면 넓은 화면에서 리스트가 끝까지 늘어나고
 * 정사각형 방 캔버스가 화면을 삼킨다. `useResponsiveColumn()`으로 쓴다.
 */
export const ContentMaxWidth = 560;

export const Overlay = {
  /** Light scrim for anchored popovers — keeps the page readable behind. */
  subtle: 'rgba(0,0,0,0.2)',
  dim: 'rgba(0,0,0,0.4)',
  strong: 'rgba(0,0,0,0.55)',
  /** Coach-mark spotlight — darkest scrim so the punched hole pops. */
  spotlight: 'rgba(0,0,0,0.62)',
} as const;

/**
 * Derived data palettes — deterministic client-side colors for entities the
 * server doesn't color yet (gacha boxes, wallpapers, member rooms, houses).
 * Picked by list position (`index % length`) in `src/api/adapters.ts`.
 */
export const GachaAccents = ['#E8DCC8', '#D6E4D2', '#F7E6C8', '#D8D2EC', '#E6D2D2', '#D2E4E6'];
export const WallpaperTints = ['#F3E9D6', '#E4F0DC', '#F7E4EA', '#E3EEF8', '#ECE8FA', '#F7ECD8'];
export const RoomTints = ['#F5E1D8', '#D9E8D4', '#F5E8C8', '#E4DCF0', '#FBE0D8', '#D8E8F0'];
/** 내 방 타일 — 멤버 로테이션과 구분되는 고정 톤. */
export const MyRoomTint = '#E8E0D0';
export const HouseBgs = ['#FFEFD8', '#E4F0DC', '#E3EEF8', '#F7E4EA', '#ECE8FA', '#F7ECD8'];
export const HouseBorders = ['#F0C88A', '#A8C898', '#9FBEDD', '#DBA8BC', '#B7A8DD', '#DDC08A'];

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

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
  /** Set for the system font only — custom fonts select weight via fontFamily. */
  fontWeight?: (typeof FontWeight)[keyof typeof FontWeight];
  fontFamily?: string;
};

/**
 * Type scale, following the Astryx standard: named roles built on a modular
 * scale (base ≈ 16, ratio ≈ 1.2; nudged to clean values for mobile). Pair with
 * a color via tokens, e.g. `<Text style={[Typography.body, { color: t.text }]}>`.
 * 전 롤 +2px 상향 (#659) — "전체적으로 작다" 피드백; fontSize·lineHeight 세트.
 */
export const Typography: Record<TypeRole, TypeStyle> = {
  display1: { fontSize: 36, lineHeight: 42, fontWeight: FontWeight.bold },
  display2: { fontSize: 30, lineHeight: 36, fontWeight: FontWeight.bold },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: FontWeight.bold },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: FontWeight.bold },
  h3: { fontSize: 20, lineHeight: 26, fontWeight: FontWeight.semibold },
  large: { fontSize: 20, lineHeight: 28, fontWeight: FontWeight.medium },
  body: { fontSize: 18, lineHeight: 26, fontWeight: FontWeight.normal },
  label: { fontSize: 16, lineHeight: 22, fontWeight: FontWeight.semibold },
  supporting: { fontSize: 14, lineHeight: 18, fontWeight: FontWeight.normal },
  code: { fontSize: 15, lineHeight: 20, fontWeight: FontWeight.medium },
};

// ---------- 앱 폰트 선택 (#382) ----------

/** Selectable app font. Persisted with the theme choice; 'system' is the OS default. */
export type BrandFontId = 'nanum' | 'pretendard' | 'jua' | 'suit' | 'system';

export const DEFAULT_FONT_ID: BrandFontId = 'nanum';

/** Settings picker entries, in display order. */
export const FONT_OPTIONS: { id: BrandFontId; name: string }[] = [
  { id: 'nanum', name: '나눔스퀘어라운드' },
  { id: 'pretendard', name: '프리텐다드' },
  { id: 'jua', name: '주아 혼합' },
  { id: 'suit', name: 'SUIT' },
  { id: 'system', name: '시스템 기본' },
];

export type FontWeightKey = keyof typeof FontWeight;

/**
 * Weight → font family (PostScript name). Files in `assets/fonts` are named
 * after their PostScript names so the same string resolves on iOS (PostScript
 * lookup) and Android (asset filename lookup). Custom-font styles must NOT set
 * `fontWeight` — Android would synthesize a fake bold on top of the real face.
 * NanumSquareRound has no 500 face, so medium reuses regular.
 */
const FontFamilies: Record<
  Exclude<BrandFontId, 'system' | 'jua'>,
  Record<FontWeightKey, string>
> = {
  nanum: {
    normal: 'NanumSquareRoundR',
    medium: 'NanumSquareRoundR',
    semibold: 'NanumSquareRoundB',
    bold: 'NanumSquareRoundEB',
  },
  pretendard: {
    normal: 'Pretendard-Regular',
    medium: 'Pretendard-Medium',
    semibold: 'Pretendard-SemiBold',
    bold: 'Pretendard-Bold',
  },
  suit: {
    normal: 'SUIT-Regular',
    medium: 'SUIT-Medium',
    semibold: 'SUIT-SemiBold',
    bold: 'SUIT-Bold',
  },
};

/** 주아 혼합: headings get the chunky BM Jua face, running text stays Pretendard. */
const JUA_HEADING_ROLES: ReadonlySet<TypeRole> = new Set(['display1', 'display2', 'h1', 'h2']);

const WEIGHT_KEY_BY_VALUE = Object.fromEntries(
  Object.entries(FontWeight).map(([k, v]) => [v, k]),
) as Record<(typeof FontWeight)[FontWeightKey], FontWeightKey>;

/**
 * The type scale for a selected font: same sizes/line-heights as `Typography`,
 * with each role's weight mapped to the matching font file. 'system' returns
 * `Typography` itself. Jua is display-only (single weight) — body roles fall
 * back to Pretendard. Use via `useTypography()`, not directly.
 *
 * 폰트별 모듈 캐시 (#678) — useTypography의 useMemo는 컴포넌트 단위라 마운트마다
 * 스케일 객체를 다시 만들었다. 폰트는 5종뿐이니 1회 계산·전역 공유가 맞고,
 * 스타일 참조 동일성이 앱 전역에서 유지된다(입력이 모두 모듈 상수라 안전).
 */
const typographyCache = new Map<BrandFontId, Record<TypeRole, TypeStyle>>();

export function typographyFor(fontId: BrandFontId): Record<TypeRole, TypeStyle> {
  const hit = typographyCache.get(fontId);
  if (hit) return hit;
  const built = buildTypography(fontId);
  typographyCache.set(fontId, built);
  return built;
}

/**
 * 폰트의 **제목 얼굴**만 뽑아온다 (#750) — 설정 행의 현재값, 폰트 피커의 글자
 * 스와치처럼 제목 롤 밖에서 그 폰트를 대표해 보여줄 때 쓴다. 주아 혼합은 제목만
 * Jua라 display1에서 가져와야 정체가 드러나고, 이렇게 하면 'Jua-Regular'
 * 리터럴이 JUA_HEADING_ROLES 한 곳에만 남는다.
 */
export function displayFaceFor(fontId: BrandFontId): Pick<TypeStyle, 'fontFamily' | 'fontWeight'> {
  const { fontFamily, fontWeight } = typographyFor(fontId).display1;
  return { fontFamily, fontWeight };
}

function buildTypography(fontId: BrandFontId): Record<TypeRole, TypeStyle> {
  if (fontId === 'system') return Typography;
  const out = {} as Record<TypeRole, TypeStyle>;
  for (const [role, style] of Object.entries(Typography) as [TypeRole, TypeStyle][]) {
    if (fontId === 'jua' && JUA_HEADING_ROLES.has(role)) {
      out[role] = {
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontFamily: 'Jua-Regular',
      };
      continue;
    }
    const families = FontFamilies[fontId === 'jua' ? 'pretendard' : fontId];
    const weightKey = WEIGHT_KEY_BY_VALUE[style.fontWeight ?? FontWeight.normal];
    out[role] = {
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      fontFamily: families[weightKey],
    };
  }
  return out;
}

/**
 * Weight emphasis that works with the active font: the system font takes a
 * real `fontWeight`, custom fonts swap the family (fake-bold guard above).
 * For ad-hoc `fontWeight:` overrides on top of a Typography role.
 */
export type EmphasisStyle = Pick<TypeStyle, 'fontWeight' | 'fontFamily'>;

export function fontEmphasis(fontId: BrandFontId, weight: FontWeightKey): EmphasisStyle {
  if (fontId === 'system') return { fontWeight: FontWeight[weight] };
  if (fontId === 'jua') return { fontFamily: FontFamilies.pretendard[weight] };
  return { fontFamily: FontFamilies[fontId][weight] };
}
