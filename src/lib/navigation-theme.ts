import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import type { SemanticColors } from '@/constants/theme';

/**
 * 라우터(React Navigation) 테마를 앱 브랜드 토큰에서 만든다.
 *
 * 기본 `DarkTheme`/`DefaultTheme`를 그대로 쓰면 루트 Stack 배경이 다크 `rgb(1,1,1)`·라이트
 * `rgb(242,242,242)`로 칠해진다. 웹 2단 프레임에서 집 탭처럼 폰 컬럼으로 좁혀 그리는 페이지는
 * 컬럼 바깥에 이 배경이 드러나, 프레임 여백(`t.screen`, 다크 갈색)과 색이 갈렸다
 * (2026-09-16 사용자 보고). 네이티브에서도 화면 전환 중 비치는 배경이라 브랜드 색이 맞다.
 */
export function navigationThemeFor(scheme: 'light' | 'dark', t: SemanticColors): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: t.primary,
      background: t.screen,
      card: t.screen,
      text: t.text,
      border: t.border,
    },
  };
}
