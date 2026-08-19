import {
  DEFAULT_THEME_ID,
  DarkThemes,
  Themes,
  Typography,
  type SemanticColors,
  type ThemeId,
  type TypeRole,
} from '@/constants/theme';

const REQUIRED_ROLES: (keyof SemanticColors)[] = [
  'appShell',
  'screen',
  'surface',
  'card',
  'surfaceMuted',
  'border',
  'text',
  'textMuted',
  'textDisabled',
  'icon',
  'primary',
  'primaryActive',
  'onPrimary',
  'onTint',
  'success',
  'warning',
  'danger',
  'dangerText',
  // DarkNeutrals 공통 블록(#755)에 실린 값들 — 키 누락이 전 테마로 퍼지므로 필수 검증.
  'disabledBg',
  'sky',
  'grass',
];

describe('brand themes', () => {
  const ids = Object.keys(Themes) as ThemeId[];

  it('includes the prototype themes', () => {
    expect(ids).toEqual(expect.arrayContaining(['cozy', 'forest', 'hanok']));
  });

  it('has a default theme', () => {
    expect(Themes[DEFAULT_THEME_ID]).toBeDefined();
  });

  it.each(ids)('theme "%s" defines every role as a hex color', (id) => {
    for (const role of REQUIRED_ROLES) {
      expect(Themes[id][role]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it.each(ids)('theme "%s" keeps onTint dark in dark mode (fixed pastel surfaces)', (id) => {
    // Fixed pastel tiles don't change in dark mode, so their ink must not
    // flip light with the theme — same dark ink in both modes.
    expect(DarkThemes[id].onTint).toBe(Themes[id].onTint);
    expect(DarkThemes[id].onTint).toBe(Themes[id].text);
  });
});

describe('type scale', () => {
  const roles = Object.keys(Typography) as TypeRole[];

  it('defines the Astryx-style roles', () => {
    expect(roles).toEqual(
      expect.arrayContaining(['display1', 'h1', 'body', 'label', 'supporting', 'code']),
    );
  });

  it.each(roles)('role "%s" has a sane size, line-height, and weight', (role) => {
    const style = Typography[role];
    expect(style.fontSize).toBeGreaterThan(0);
    expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
    expect(style.fontWeight).toMatch(/^[1-9]00$/);
  });
});

/** WCAG 상대 휘도. */
function luminance(hex: string) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(fg: string, bg: string) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

describe('dangerText 대비 (#900)', () => {
  // 회원탈퇴처럼 파괴적 동작을 **본문 크기 글자**로 표시하므로 AA 4.5:1을
  // 넘어야 한다. `danger`(채움·테두리용)를 그대로 글자에 쓰면 흰 배경에서
  // 3.1:1로 미달이라 별도 토큰을 뒀다 — 그 전제를 여기서 붙잡는다.
  it.each(Object.entries(Themes))('%s (라이트) — 서피스 위에서 4.5:1을 넘는다', (_id, t) => {
    for (const bg of [t.surface, t.screen, t.card]) {
      expect(contrast(t.dangerText, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(Object.entries(DarkThemes))('%s (다크) — 서피스 위에서 4.5:1을 넘는다', (_id, t) => {
    for (const bg of [t.surface, t.screen, t.card]) {
      expect(contrast(t.dangerText, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
