import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Storybook 스토리 테스트 전용 Vitest 설정 (앱 단위 테스트는 jest 그대로).
 *
 * - `storybook` 프로젝트: `.storybook/main.ts`의 모든 스토리를 실제 Chromium에서 렌더하고
 *   play 함수와 addon-a11y 검사를 실행한다. `npx --no-install vitest run --project=storybook`
 * - `visual` 프로젝트: 핵심 스토리의 스크린샷 기준 이미지 비교(`stories/__visual__/`).
 *   `npx --no-install vitest run --project=visual` — 기준 이미지는 CI(linux)에서만 갱신한다.
 *
 * package.json scripts는 네이티브 지문 입력이라 등록하지 않고 CLI를 직접 호출한다.
 */
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
