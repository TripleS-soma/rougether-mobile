import type { Preview } from '@storybook/react-native-web-vite';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  type BrandFontId,
  DEFAULT_FONT_ID,
  DEFAULT_THEME_ID,
  FONT_OPTIONS,
  Spacing,
  THEME_OPTIONS,
  type ThemeId,
} from '@/constants/theme';
import { BrandThemePreview, useTokens } from '@/hooks/use-tokens';
import { type AppLanguage, DEFAULT_LANGUAGE, i18n, isAppLanguage, LANGUAGE_OPTIONS } from '@/i18n';

import './canvas.css';
import './fonts.css';

/**
 * 뷰포트 프리셋 — 앱이 실제로 그려지는 폭들. 320은 가장 좁은 폰(영어 문구 잘림 확인),
 * 480·960·1200은 웹 앱 프레임 경계(`use-app-frame`의 폰 컬럼·2단 시작·2단 최대).
 */
export const APP_VIEWPORTS = {
  phoneSmall: { name: '소형 폰 320', styles: { width: '320px', height: '640px' }, type: 'mobile' },
  phone: { name: 'iPhone 390', styles: { width: '390px', height: '844px' }, type: 'mobile' },
  webColumn: {
    name: '웹 폰 컬럼 480',
    styles: { width: '480px', height: '900px' },
    type: 'mobile',
  },
  webSplit: {
    name: '웹 2단 시작 960',
    styles: { width: '960px', height: '900px' },
    type: 'tablet',
  },
  webWide: {
    name: '웹 2단 최대 1200',
    styles: { width: '1200px', height: '900px' },
    type: 'desktop',
  },
} as const;

function Canvas({ children, width }: { children: ReactNode; width: number | '100%' }) {
  const t = useTokens();
  return (
    <View style={[styles.canvas, { backgroundColor: t.screen }]}>
      <View style={[styles.content, { maxWidth: width }]}>{children}</View>
    </View>
  );
}

/** 캔버스는 노치·홈 인디케이터가 없는 사각형 — 안전 영역 0으로 고정(하단 탭·헤더 스토리용). */
const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * 스토리 언어 — 앱의 `LanguageProvider`(저장·기기 감지·계측)를 거치지 않고 같은 i18n
 * 인스턴스의 언어만 바꾼다. 앱 저장 설정이나 계측 차원에 흔적을 남기지 않는다.
 */
function applyLanguage(value: unknown): AppLanguage {
  const next = isAppLanguage(value) ? value : DEFAULT_LANGUAGE;
  if (i18n.language !== next) void i18n.changeLanguage(next);
  return next;
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: '앱 브랜드 테마',
      toolbar: {
        title: '테마',
        icon: 'paintbrush',
        dynamicTitle: true,
        items: THEME_OPTIONS.map(({ id, name }) => ({ value: id, title: name })),
      },
    },
    mode: {
      description: '화면 밝기',
      toolbar: {
        title: '화면',
        icon: 'circlehollow',
        dynamicTitle: true,
        items: [
          { value: 'light', title: '라이트' },
          { value: 'dark', title: '다크' },
        ],
      },
    },
    font: {
      description: '앱 글꼴',
      toolbar: {
        title: '글꼴',
        icon: 'paragraph',
        dynamicTitle: true,
        items: FONT_OPTIONS.map(({ id, name }) => ({ value: id, title: name })),
      },
    },
    locale: {
      description: '앱 언어 (i18n)',
      toolbar: {
        title: '언어',
        icon: 'globe',
        dynamicTitle: true,
        items: LANGUAGE_OPTIONS.map(({ id, name }) => ({ value: id, title: name })),
      },
    },
  },
  initialGlobals: {
    theme: DEFAULT_THEME_ID,
    mode: 'light',
    font: DEFAULT_FONT_ID,
    locale: DEFAULT_LANGUAGE,
  },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true, matchers: { color: /(background|color)$/i } },
    options: { storySort: { order: ['디자인 토큰', '컴포넌트'] } },
    backgrounds: { disable: true },
    viewport: { options: APP_VIEWPORTS },
    // 접근성 검사 (addon-a11y) — 위반이 있으면 CI 실패. 색 대비(color-contrast)만 제외한다: 테마 5종 토큰
    // 조정이 필요한 디자인 결정이라 #1389 잔여로 남긴다. 스토리에서 rules를 덮어쓸 땐 이 제외도 함께 적을 것.
    a11y: { test: 'error', config: { rules: [{ id: 'color-contrast', enabled: false }] } },
  },
  decorators: [
    (Story, { globals, parameters }) => {
      const language = applyLanguage(globals.locale);
      // 뷰포트를 고르면 캔버스 폭 제한(기본 420)을 풀어 그 폭 그대로 보이게 한다.
      const viewport = globals.viewport as { value?: string } | string | undefined;
      const viewportKey = typeof viewport === 'string' ? viewport : viewport?.value;
      const width = viewportKey ? '100%' : (parameters.canvasWidth ?? 420);
      return (
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <BrandThemePreview
            themeId={globals.theme as ThemeId}
            mode={globals.mode === 'dark' ? 'dark' : 'light'}
            fontId={globals.font as BrandFontId}>
            {/* 언어가 바뀌면 하위 트리를 새로 그려 useT()를 쓰지 않는 모듈 문구도 갱신한다. */}
            <Canvas key={language} width={width}>
              <Story />
            </Canvas>
          </BrandThemePreview>
        </SafeAreaProvider>
      );
    },
  ],
};

const styles = StyleSheet.create({
  canvas: { minHeight: '100%', padding: Spacing.four, alignItems: 'center' },
  content: { width: '100%' },
});

export default preview;
