/**
 * 테스트용 QueryClientProvider (#1027) — react-query 훅을 `renderHook`으로
 * 돌릴 때 감싼다. 앱 기본값(`createQueryClient`)을 그대로 쓰면 테스트가
 * 흔들리므로 세 가지를 덮는다:
 *
 *   retry: false   재시도 대기가 붙으면 실패 경로 테스트가 타임아웃한다
 *   staleTime: 0   "무효화하면 다시 받는가"를 확인하려면 즉시 stale이어야 한다
 *
 *
 * `gcTime`은 덮지 않는다 — 기본값(5분)이 어떤 테스트보다 길어 단언이 뒤집힐 일이
 * 없다. `Infinity`와 `0`을 둘 다 시도해 봤지만 스위트 전체를 돌 때 나오는 jest
 * 워커 경고와는 무관했다(경고는 그대로였다).
 *
 * 클라이언트는 호출마다 새로 만든다 — 테스트 간 캐시가 새면 순서에 의존한다.
 */
import { type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** `renderHook(fn, { wrapper: queryWrapper() })` 형태로 쓴다. */
export function queryWrapper(client = createTestQueryClient()) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/**
 * JSX로 감쌀 때 쓰는 형태 — `AppShell`·`AppRoot`처럼 내부에서 react-query 훅을
 * 부르는 트리를 렌더하는 테스트용. 실제 앱(`src/app/_layout.tsx`)과 같은 순서로
 * `AuthProvider` **바깥**에 둔다.
 *
 * 인스턴스마다 클라이언트를 새로 만든다 — 테스트 간 캐시가 새지 않게.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createTestQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
