// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

// 배럴 import 하나가 아이콘 세트 18종 glyphmap·폰트(JS 432KB + 에셋 3.5MB)를 끌어온다
// (성능 장부 B2). 세트별 경로로 가져올 것.
const RESTRICTED_PATHS = [
  {
    name: '@expo/vector-icons',
    message: "세트별 경로로: import Ionicons from '@expo/vector-icons/Ionicons'",
  },
];

// 상위 디렉터리 상대경로 대신 별칭(`@/…`)으로 — AGENTS.md 임포트 규칙(장부 21번).
// 같은 폴더(`./x`)는 허용한다: api 모듈끼리처럼 한 묶음 안의 참조다.
const PARENT_RELATIVE = [
  { regex: '^\\.\\./', message: "상위 상대경로 대신 별칭으로: import … from '@/…'" },
];

module.exports = defineConfig([
  expoConfig,
  // Turn off ESLint rules that conflict with Prettier formatting.
  eslintConfigPrettier,
  {
    rules: {
      'no-restricted-imports': ['error', { paths: RESTRICTED_PATHS, patterns: PARENT_RELATIVE }],
    },
  },
  {
    // 앱 코드에 디버그 로그를 남기지 않는다 — 경고·에러는 허용(Sentry 브레드크럼으로도 쓰인다).
    // Dev 갤러리는 콜백 확인용 로그가 본업이라 제외.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/dev/**', '**/__tests__/**'],
    rules: { 'no-console': ['error', { allow: ['warn', 'error'] }] },
  },
  {
    // 테스트는 src 밖(app.json·contracts·scripts)을 가리킬 별칭이 없어 상위 상대경로를 허용한다.
    files: ['**/__tests__/**', 'jest/**'],
    rules: { 'no-restricted-imports': ['error', { paths: RESTRICTED_PATHS }] },
  },
  {
    ignores: ['dist/*', 'web-build/storybook/**', 'node_modules/*', '.expo/*'],
  },
]);
