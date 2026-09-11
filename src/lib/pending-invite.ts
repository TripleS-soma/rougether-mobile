import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 초대 링크 딥링크 핸드오프 (#624·#667) — `rougether://join?code=…` /
 * `rougether://invite?code=…`로 열린 라우트가 코드를 맡기고, 앱 셸이 구독해
 * 각각 집 탐색·친구 초대 확인으로 잇는다.
 *
 * ## 보관을 먼저, 전달은 그 다음 (#896)
 *
 * 예전엔 리스너가 있으면 **전달만 하고 보관하지 않았다**. 그래서 앱이 이미
 * 떠 있는 상태(웜 스타트)에서 링크를 열면 코드가 리스너로 흘러들어가고,
 * 그 전달이 실패하면 **복구할 방법이 없었다** — 콜드 스타트만 되고 웜은 안
 * 되던 원인이다.
 *
 * 지금은 **항상 보관**하고, 목적지가 "반영했다"고 알려올 때만 비운다
 * (`clearPending*`). 그래서 셸이 리마운트되거나 전달이 유실돼도 다음 구독에서
 * 다시 흘러간다.
 *
 * ## 기기에도 보관한다 (#1007)
 *
 * 새로 설치한 사람은 링크를 연 뒤 로그인·온보딩을 거쳐야 셸이 뜬다. 그 사이 앱을
 * 껐다 켜면 메모리 보관분이 사라졌다. 이제 맡긴 코드는 AsyncStorage에도 적고,
 * 셸이 마운트될 때 `hydratePendingInvites()`로 되살린다. 탈퇴(`wipeLocalAppData`,
 * `rougether.` 접두)는 함께 지운다.
 */

type Listener = (code: string) => void;

const KEYS = {
  house: 'rougether.pending-invite.house.v1',
  friend: 'rougether.pending-invite.friend.v1',
} as const;

function channel(key: string) {
  let pending: string | null = null;
  let listener: Listener | null = null;
  // 이번 실행에서 이미 맡기거나 비웠으면, 늦게 끝난 복원이 그걸 덮지 않는다.
  let touched = false;

  return {
    set(code: string) {
      const clean = code.trim().toUpperCase();
      if (!clean) return;
      // 보관이 먼저다 — 리스너 전달이 유실돼도 다음 구독이 살린다.
      pending = clean;
      touched = true;
      void AsyncStorage.setItem(key, clean).catch(() => {});
      listener?.(clean);
    },
    subscribe(onCode: Listener) {
      listener = onCode;
      // 보관분은 지우지 않고 전달만 한다 — 소비는 목적지가 알려온다.
      if (pending) onCode(pending);
      return () => {
        if (listener === onCode) listener = null;
      };
    },
    clear() {
      pending = null;
      touched = true;
      void AsyncStorage.removeItem(key).catch(() => {});
    },
    peek() {
      return pending;
    },
    async hydrate() {
      if (touched || pending) return;
      try {
        const saved = await AsyncStorage.getItem(key);
        if (!saved || touched || pending) return;
        pending = saved;
        listener?.(saved);
      } catch {
        // 못 읽으면 링크를 다시 누르면 된다 — 조용히.
      }
    },
  };
}

const house = channel(KEYS.house);
const friend = channel(KEYS.friend);

/** 기기에 남은 코드를 되살린다 — 셸 마운트에서 1회. 이미 맡긴 코드가 있으면 그대로. */
export async function hydratePendingInvites(): Promise<void> {
  await Promise.all([house.hydrate(), friend.hydrate()]);
}

export function setPendingInviteCode(code: string) {
  house.set(code);
}

/** 셸이 마운트에서 1회 구독 — 해제 함수를 돌려준다. */
export function subscribePendingInviteCode(onCode: Listener): () => void {
  return house.subscribe(onCode);
}

/** 집 탐색이 코드 미리보기를 실제로 띄웠을 때. */
export function clearPendingInviteCode() {
  house.clear();
}

/** 소비 전 집 코드가 있나 — 붙여넣기를 물을지 판단할 때. */
export function peekPendingInviteCode(): string | null {
  return house.peek();
}

// --- 친구 초대 채널 (#667) — 같은 계약, 목적지만 친구 초대 확인. ---

export function setPendingFriendInviteCode(code: string) {
  friend.set(code);
}

/** 셸이 마운트에서 1회 구독 — 해제 함수를 돌려준다. */
export function subscribePendingFriendInviteCode(onCode: Listener): () => void {
  return friend.subscribe(onCode);
}

/** 친구 초대 확인이 끝났을 때(받기·나중에·무효 코드). */
export function clearPendingFriendInviteCode() {
  friend.clear();
}

/** 소비 전 친구 코드가 있나. */
export function peekPendingFriendInviteCode(): string | null {
  return friend.peek();
}
