import {
  fetchCategories,
  fetchMe,
  fetchRoutines,
  fetchToday,
  fetchTodos,
  fetchWallets,
} from '@/api';

/**
 * 나의 방 첫 데이터 선행 요청 (성능 장부 N1).
 *
 * 앱 루트는 온보딩 상태(`GET /onboarding` 등)를 확인한 **뒤에야** 셸을 마운트했고, 셸의
 * `useMyRoomData`가 그제야 6개 요청을 보냈다 — 첫 화면까지 왕복이 한 번 더 들었다(실측:
 * 응답 지연 150ms에서 루틴 표시까지 450ms). 온보딩을 이미 마친 기기(로컬 기록 있음)는
 * 게이트 확인과 **동시에** 이 요청을 띄워 두고, 셸이 마운트되며 넘겨받는다.
 *
 * - 한 번만 넘겨준다(`take`). 두 번째 로드(당겨서 새로고침·재시도)는 항상 새로 받는다.
 * - 오래된 결과는 쓰지 않는다(`MAX_AGE_MS`) — 게이트에서 시간이 걸린 사이 바뀐 데이터를
 *   첫 화면에 보이지 않게.
 * - 계정이 바뀌면 버린다.
 * - 실패한 선행 요청은 넘기지 않는다 — 셸이 평소처럼 다시 받는다.
 */
export type MyRoomBootData = [
  Awaited<ReturnType<typeof fetchCategories>>,
  Awaited<ReturnType<typeof fetchRoutines>>,
  Awaited<ReturnType<typeof fetchTodos>>,
  Awaited<ReturnType<typeof fetchToday>>,
  Awaited<ReturnType<typeof fetchWallets>>,
  Awaited<ReturnType<typeof fetchMe>>,
];

export const MY_ROOM_PREFETCH_MAX_AGE_MS = 15_000;

let pending: {
  userId: number;
  at: number;
  promise: Promise<MyRoomBootData>;
  failed: boolean;
} | null = null;

export function fetchMyRoomBootData(): Promise<MyRoomBootData> {
  return Promise.all([
    // includeDeleted → deleted categories still resolve for past records.
    fetchCategories(true),
    fetchRoutines(),
    fetchTodos(),
    fetchToday(),
    fetchWallets(),
    fetchMe(),
  ]);
}

export function prefetchMyRoom(userId: number, now: () => number = Date.now): void {
  if (pending && pending.userId === userId && now() - pending.at < MY_ROOM_PREFETCH_MAX_AGE_MS)
    return;
  const entry = { userId, at: now(), promise: fetchMyRoomBootData(), failed: false };
  entry.promise.catch(() => {
    entry.failed = true;
  });
  pending = entry;
}

/** 선행 요청을 넘겨받는다 — 같은 계정·아직 신선·실패 전일 때만, 한 번만. */
export function takeMyRoomPrefetch(
  userId: number | null | undefined,
  now: () => number = Date.now,
): Promise<MyRoomBootData> | null {
  const entry = pending;
  pending = null;
  if (!entry || userId == null || entry.userId !== userId || entry.failed) return null;
  if (now() - entry.at >= MY_ROOM_PREFETCH_MAX_AGE_MS) return null;
  return entry.promise;
}

/** 테스트용. */
export function resetMyRoomPrefetch() {
  pending = null;
}
