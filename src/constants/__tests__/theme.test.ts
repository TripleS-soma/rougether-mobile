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
