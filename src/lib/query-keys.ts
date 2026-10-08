import type { FeedBoardType } from '@/api/types';

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
  minigames: {
    catalog: (rulesVersion: number) => ['minigames', 'catalog', rulesVersion] as const,
    leaderboard: (userId: number | null | undefined, gameCode: string) =>
      ['minigames', userId, 'leaderboard', gameCode] as const,
  },
  recommendations: ['recommendations'] as const,
  gachas: ['gachas', 'categories'] as const,
  starterGacha: (userId: number | null | undefined) => ['starter-gacha', userId] as const,
  starterRoutine: (userId: number | null | undefined) => ['starter-routine', userId] as const,
  appIcon: {
    all: ['app-icon'] as const,
    byUser: (userId: number | null | undefined) => ['app-icon', userId] as const,
  },
  /** 집 온보딩 자동 입주 허용 (#1407, 방장 전용 GET /houses/{id}/auto-join). */
  houseAutoJoin: (houseId: number | undefined) => ['house', 'auto-join', houseId] as const,
  /**
   * 집 채팅 (#1408) — 방 상태(POST /houses/{id}/chat-room의 응답). 레일의 안 읽음 배지와
   * 채팅 화면이 같은 캐시를 본다. 소켓·읽음 응답이 오면 setQueryData로 갱신한다.
   */
  chatRoom: (userId: number | null | undefined, houseId: number | undefined) =>
    ['chat', userId, 'house-room', houseId] as const,
  /** 친구 초대 리워드 (#518) — 내 코드·보상 현황. */
  invites: (userId: number | null | undefined) => ['invites', userId] as const,
  /** 재화 증감 이력 (#734) — 무한 쿼리, 페이지 파라미터는 0부터. */
  walletHistory: (userId: number | null | undefined) => ['wallet-history', userId] as const,
  /** 주간 회고 (#852) — 목록(최신 1건만 쓴다)과 상세(열 때 지연 로드). */
  weeklyReports: {
    list: (userId: number | null | undefined) => ['weekly-reports', userId, 'list'] as const,
    detail: (userId: number | null | undefined, reportId: number | null) =>
      ['weekly-reports', userId, 'detail', reportId] as const,
  },
  /** 친구 방 방명록 (#147) — 방 주인 + 같이 사는 집 단위 커서 페이지. */
  guestbook: (
    userId: number | null | undefined,
    roomOwnerId: number | null,
    houseId: number | null,
  ) => ['guestbook', userId, roomOwnerId, houseId] as const,
  /** 내 버그 제보 목록 (#496). */
  bugReports: (userId: number | null | undefined) => ['bug-reports', userId] as const,
  /** 진행 중인 출석 이벤트 (#851) — 없으면 null. */
  attendance: (userId: number | null | undefined) => ['attendance', userId] as const,
  /** 상점 공개 카탈로그 (GET /items) — 사용자 무관. `owned` 플래그는 인벤토리로 덮는다. */
  items: ['items'] as const,
  /**
   * 집 구성원 방 (GET /houses/{id}/members/{mid}/room) — 좌석 미리보기와 친구 방 방문이
   * 같은 응답을 나눠 쓴다(성능 장부 N5). 사용자 캐시는 로그아웃 시 통째로 비워진다.
   */
  memberRoom: {
    all: ['house-member-room'] as const,
    one: (houseId: number, membershipId: number) =>
      ['house-member-room', houseId, membershipId] as const,
  },
  /** 집 커버 카탈로그 (GET /houses/cover-images) — 사용자 무관. */
  houseCovers: ['house-covers'] as const,
  /** 내 인벤토리 (GET /me/items, itemId↔userItemId) — 뽑기·구매·AI 가구가 갱신한다. */
  myItems: {
    all: ['me', 'items'] as const,
    byUser: (userId: number | null | undefined) => ['me', 'items', userId] as const,
  },
  /** 내 방 (GET /rooms/me) — 배치·표면 슬롯·layoutRevision·거미줄. */
  myRoom: {
    all: ['rooms', 'me'] as const,
    byUser: (userId: number | null | undefined) => ['rooms', 'me', userId] as const,
  },
  /** 보유 캐릭터 (GET /me/characters) — 뽑기로 캐릭터를 얻으면 무효화한다. */
  myCharacters: {
    all: ['me', 'characters'] as const,
    byUser: (userId: number | null | undefined) => ['me', 'characters', userId] as const,
  },
  /**
   * 달력 탭 (GET /calendar, GET /calendar/month) — 날짜별 목록과 달별 점.
   * 루틴·투두 변경은 `all`로 통째 무효화한다(방문한 날짜·달만 재조회된다).
   */
  calendar: {
    all: (userId: number | null | undefined) => ['calendar', userId] as const,
    day: (userId: number | null | undefined, dateIso: string) =>
      ['calendar', userId, 'day', dateIso] as const,
    month: (userId: number | null | undefined, yearMonth: string) =>
      ['calendar', userId, 'month', yearMonth] as const,
  },
  /**
   * 공개 SNS 피드 (#1409). 목록은 무한 쿼리(cursor = 마지막 postId), 상세·댓글은 게시물별.
   * 좋아요·댓글 수는 목록과 상세 캐시를 함께 고친다(`hooks/feed-cache.ts`).
   * 목록은 게시판(서버 #428)별로 따로 — `ALL`(통합)·`FREE`·`VERIFICATION`. 등록·수정·삭제는
   * `lists` 접두로 무효화·패치해 통합 피드와 게시판 목록을 한꺼번에 맞춘다.
   */
  feed: {
    all: (userId: number | null | undefined) => ['feed', userId] as const,
    lists: (userId: number | null | undefined) => ['feed', userId, 'posts'] as const,
    list: (
      userId: number | null | undefined,
      authorId: number | null,
      board: 'ALL' | FeedBoardType = 'ALL',
    ) => ['feed', userId, 'posts', authorId, board] as const,
    post: (userId: number | null | undefined, postId: number | null) =>
      ['feed', userId, 'post', postId] as const,
    comments: (userId: number | null | undefined, postId: number | null) =>
      ['feed', userId, 'comments', postId] as const,
    /** 모든 게시물의 댓글 — 차단(#1428) 직후 그 작성자 댓글을 한꺼번에 지울 때. */
    allComments: (userId: number | null | undefined) => ['feed', userId, 'comments'] as const,
  },
  /** 내가 차단한 사용자 (#1428, GET /me/blocks) — 무한 쿼리, cursor = 차단 기록 id. */
  blockedUsers: (userId: number | null | undefined) => ['blocked-users', userId] as const,
  /**
   * 가구 거래소 (#1427) — 상세의 `owned`·`isCreator`가 요청자 기준이라 목록까지 전부 사용자별.
   * 주문·취소·발행 결과가 나오면 `all`로 통째 무효화한다(목록·상세·체결·내 주문).
   */
  market: {
    all: (userId: number | null | undefined) => ['market', userId] as const,
    assets: (userId: number | null | undefined) => ['market', userId, 'assets'] as const,
    asset: (userId: number | null | undefined, assetId: number | null) =>
      ['market', userId, 'asset', assetId] as const,
    trades: (userId: number | null | undefined, assetId: number | null) =>
      ['market', userId, 'trades', assetId] as const,
    orders: (userId: number | null | undefined, status: 'OPEN' | 'CLOSED') =>
      ['market', userId, 'orders', status] as const,
  },
};
