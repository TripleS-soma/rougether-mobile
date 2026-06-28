import { DEFAULT_THEME_ID, Themes, type SemanticColors, type ThemeId } from '@/constants/theme';

const REQUIRED_ROLES: (keyof SemanticColors)[] = [
  'appShell',
  'screen',
  'surface',
  'surfaceMuted',
  'border',
  'text',
  'textMuted',
  'primary',
  'primaryActive',
  'onPrimary',
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
});
