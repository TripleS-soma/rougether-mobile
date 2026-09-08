import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AuthProvider } from '@/hooks/use-auth';
import { QueryProvider } from '@/test-utils/query-wrapper';

/**
 * 앱 트리 순서(`src/app/_layout.tsx`)대로 Query → Auth로 감싼 render.
 * `AppShell`·`AppRoot`처럼 내부에서 react-query·auth 훅을 부르는 트리용 —
 * app-shell 테스트에서만 같은 JSX 래핑이 25번 반복되던 것.
 */
export function renderWithProviders(ui: ReactElement) {
  return render(
    <QueryProvider>
      <AuthProvider>{ui}</AuthProvider>
    </QueryProvider>,
  );
}
