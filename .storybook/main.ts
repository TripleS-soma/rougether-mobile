import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-native-web-vite';
import { mergeConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: '@storybook/react-native-web-vite',
  core: { disableTelemetry: true },
  async viteFinal(config) {
    return mergeConfig(config, {
      // 앱은 react-native-svg-transformer로 .svg를 컴포넌트로 가져온다(하단 탭 아이콘).
      // 웹 번들러에서는 같은 기본 export 컴포넌트가 되도록 svgr로 맞춘다.
      plugins: [svgr({ include: '**/*.svg', svgrOptions: { exportType: 'default' } })],
      resolve: {
        alias: {
          '@/assets': fileURLToPath(new URL('../assets', import.meta.url)),
          '@': fileURLToPath(new URL('../src', import.meta.url)),
        },
      },
      // 스토리 테스트(Vitest 브라우저 모드) 도중 Vite가 새 의존성을 발견해 페이지를 다시 읽으면
      // React가 두 벌 올라가 'reading useContext' 오류가 난다. 늦게 발견되는 것을 미리 묶는다.
      optimizeDeps: {
        include: [
          'react-native-gesture-handler',
          'react-native-safe-area-context',
          'react-native-reanimated',
          '@hyunbinseo/holidays-kr/all',
        ],
      },
      // Storybook is a standalone web entry; never load Expo's app environment.
      define: { __DEV__: true, 'process.env.EXPO_OS': JSON.stringify('web') },
    });
  },
};

export default config;
