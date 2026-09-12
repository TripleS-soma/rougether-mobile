import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-native-web-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs'],
  framework: '@storybook/react-native-web-vite',
  core: { disableTelemetry: true },
  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@/assets': fileURLToPath(new URL('../assets', import.meta.url)),
          '@': fileURLToPath(new URL('../src', import.meta.url)),
        },
      },
      // Storybook is a standalone web entry; never load Expo's app environment.
      define: { __DEV__: true, 'process.env.EXPO_OS': JSON.stringify('web') },
    });
  },
};

export default config;
