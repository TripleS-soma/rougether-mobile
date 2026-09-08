/**
 * react-query 키 레지스트리 (#1027 후속, 리팩토링 4묶음) — 키 모양을 한 곳에서.
 *
 * 규칙: 사용자별로 달라지는 데이터는 두 번째 원소에 userId를 둔다(계정 전환 시 다른
 * 사용자의 캐시를 읽지 않게). 사용자 무관 카탈로그(뽑기 기계)는 스코프 없음. 추천은
 * 사용자별이지만 세션이 지워질 때 `bindSessionCacheReset`이 캐시 전체를 비우므로
 * 스코프 없이 두었다 — 같은 세션 안에서 사용자가 바뀌는 경로가 없다.
 *
 * 앞으로 이관하는 훅은 여기에 키를 추가하고, 무효화는 접두 키(`all`)로 한다.
 */
export const queryKeys = {
  recommendations: ['recommendations'] as const,
  gachas: ['gachas', 'categories'] as const,
  starterRoutine: (userId: number | null | undefined) => ['starter-routine', userId] as const,
  appIcon: {
    all: ['app-icon'] as const,
    byUser: (userId: number | null | undefined) => ['app-icon', userId] as const,
  },
  /** 친구 초대 리워드 (#518) — 내 코드·보상 현황. */
  invites: (userId: number | null | undefined) => ['invites', userId] as const,
  /** 재화 증감 이력 (#734) — 무한 쿼리, 페이지 파라미터는 0부터. */
  walletHistory: (userId: number | null | undefined) => ['wallet-history', userId] as const,
};
