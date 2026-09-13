import type { Preview } from '@storybook/react-native-web-vite';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

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

import './fonts.css';

function Canvas({ children, width }: { children: ReactNode; width: number }) {
  const t = useTokens();
  return (
    <View style={[styles.canvas, { backgroundColor: t.screen }]}>
      <View style={[styles.content, { maxWidth: width }]}>{children}</View>
    </View>
  );
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
  },
  initialGlobals: { theme: DEFAULT_THEME_ID, mode: 'light', font: DEFAULT_FONT_ID },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true, matchers: { color: /(background|color)$/i } },
    options: { storySort: { order: ['디자인 토큰', '컴포넌트'] } },
    backgrounds: { disable: true },
  },
  decorators: [
    (Story, { globals, parameters }) => (
      <BrandThemePreview
        themeId={globals.theme as ThemeId}
        mode={globals.mode === 'dark' ? 'dark' : 'light'}
        fontId={globals.font as BrandFontId}>
        <Canvas width={parameters.canvasWidth ?? 420}>
          <Story />
        </Canvas>
      </BrandThemePreview>
    ),
  ],
};

const styles = StyleSheet.create({
  canvas: { minHeight: '100%', padding: Spacing.four, alignItems: 'center' },
  content: { width: '100%' },
});

export default preview;
