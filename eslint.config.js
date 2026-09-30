// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  // Turn off ESLint rules that conflict with Prettier formatting.
  eslintConfigPrettier,
  {
    // 배럴 import 하나가 아이콘 세트 18종 glyphmap·폰트(JS 432KB + 에셋 3.5MB)를 끌어온다
    // (성능 장부 B2). 세트별 경로로 가져올 것.
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@expo/vector-icons',
              message: "세트별 경로로: import Ionicons from '@expo/vector-icons/Ionicons'",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['dist/*', 'web-build/storybook/**', 'node_modules/*', '.expo/*'],
  },
]);
