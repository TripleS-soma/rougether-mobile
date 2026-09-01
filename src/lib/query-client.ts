/**
 * react-query 기반 (#1027) — 서버 상태의 캐시·무효화·재시도를 한 곳에 모은다.
 *
 * ## 왜 도입했나
 *
 * 훅 23개가 각자 `useState` + `useEffect`로 패칭·캐시·뮤테이션을 들고 있었고,
 * 재조회를 셸을 통해 손으로 꿴 지점이 70곳이었다. 무효화 규칙이 코드 어디에도
 * 없다 보니 같은 종류의 누락이 반복됐다 — `use-my-room-data`의 루틴 수정이
 * 완료 기록을 옛 id에 남기는 버그(#1028)가 그 결과다.
 *
 * ## 점진 도입이다
 *
 * 기존 훅을 통째로 옮기지 않는다. **새로 만드는 데이터 훅부터** 이걸 쓰고,
 * 기존 훅은 그 파일을 만질 때 함께 옮긴다 (#1027의 3단계).
 */
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * 기존 훅은 마운트마다 1회 받고 끝이었다. staleTime을 0(기본)으로 두면
         * 화면을 오갈 때마다 재조회가 붙어 **지금보다 요청이 늘어난다** — 탭
         * 전환이 잦은 앱이라 체감이 크다. 30초면 같은 세션의 탭 왕복은 캐시로
         * 덮고, 그 이상 지나면 새로 받는다.
         */
        staleTime: 30_000,
        /**
         * 종전 코드는 재시도가 없었다(실패 시 조용히 빈 값). 기본값 3회는
         * 실패한 화면이 오래 매달려 있게 하므로 1회로 줄인다 — 순간적인
         * 네트워크 끊김만 흡수하고, 진짜 장애는 빨리 에러로 드러낸다.
         */
        retry: 1,
        /**
         * 앱을 백그라운드에 두었다 돌아오면 stale한 것만 다시 받는다. 종전에는
         * 재조회가 아예 없어 어제 데이터가 그대로 보였다. 아래 focusManager
         * 배선이 있어야 RN에서 실제로 동작한다.
         */
        refetchOnWindowFocus: true,
      },
    },
  });
}

/**
 * RN 포커스 감지 (#1027) — react-query의 기본 포커스 감지는 웹 `window` 이벤트라
 * 네이티브에서 영영 발화하지 않는다. AppState로 갈아끼운다.
 *
 * **온라인 감지(onlineManager)는 배선하지 않았다.** 그러려면
 * `@react-native-community/netinfo`가 필요한데 그건 **네이티브 모듈이라 지문이
 * 바뀌고**, 이 변경을 OTA로 못 내보내게 된다. netinfo 없는 RN에서 react-query는
 * "항상 온라인"으로 가정하고 요청을 시도한다 — 실패는 기존과 같이 에러로
 * 떨어지므로 동작상 손해가 없다. 네이티브 빌드 윈도우가 열릴 때 재검토할 것.
 *
 * 웹에서는 기본 감지가 이미 맞으므로 건드리지 않는다.
 *
 * @returns 구독 해제 함수
 */
export function subscribeAppStateFocus(): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });
  return () => sub.remove();
}
