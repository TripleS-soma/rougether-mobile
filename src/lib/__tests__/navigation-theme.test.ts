import { DarkTheme, DefaultTheme } from '@react-navigation/native';

import { DarkThemes, Themes } from '@/constants/theme';
import { navigationThemeFor } from '@/lib/navigation-theme';

// 라우터 배경이 브랜드 화면색과 같아야 웹 2단 프레임에서 폰 컬럼 바깥 색이 갈리지 않는다.
describe('navigationThemeFor', () => {
  it('다크: 기본 DarkTheme의 거의 검정 배경 대신 브랜드 화면색을 쓴다', () => {
    const t = DarkThemes.cozy;
    const theme = navigationThemeFor('dark', t);
    expect(theme.dark).toBe(true);
    expect(theme.colors.background).toBe(t.screen);
    expect(theme.colors.background).not.toBe(DarkTheme.colors.background);
    expect(theme.fonts).toBe(DarkTheme.fonts);
  });

  it('라이트: 기본 회색 배경 대신 브랜드 화면색을 쓴다', () => {
    const t = Themes.cozy;
    const theme = navigationThemeFor('light', t);
    expect(theme.dark).toBe(false);
    expect(theme.colors.background).toBe(t.screen);
    expect(theme.colors.background).not.toBe(DefaultTheme.colors.background);
    expect(theme.colors.card).toBe(t.screen);
  });
});
