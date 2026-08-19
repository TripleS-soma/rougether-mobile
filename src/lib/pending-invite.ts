/**
 * 초대 링크 딥링크 핸드오프 (#624·#667) — `rougether://join?code=…` /
 * `rougether://invite?code=…`로 열린 라우트가 코드를 맡기고, 앱 셸이 구독해
 * 각각 집 탐색·친구 초대 화면으로 잇는다.
 *
 * ## 보관을 먼저, 전달은 그 다음 (#896)
 *
 * 예전엔 리스너가 있으면 **전달만 하고 보관하지 않았다**. 그래서 앱이 이미
 * 떠 있는 상태(웜 스타트)에서 링크를 열면 코드가 리스너로 흘러들어가고,
 * 그 전달이 실패하면 **복구할 방법이 없었다** — 콜드 스타트만 되고 웜은 안
 * 되던 원인이다.
 *
 * 지금은 **항상 보관**하고, 목적지 화면이 "반영했다"고 알려올 때만 비운다
 * (`clearPending*`). 그래서 셸이 리마운트되거나 전달이 유실돼도 다음 구독에서
 * 다시 흘러간다. 소비 신호는 이미 양쪽 화면에 있다:
 *   집 탐색   `onInitialCodeConsumed`
 *   친구 초대 `onInitialRedeemCodeConsumed`
 */

type Listener = (code: string) => void;

function channel() {
  let pending: string | null = null;
  let listener: Listener | null = null;

  return {
    set(code: string) {
      const clean = code.trim().toUpperCase();
      if (!clean) return;
      // 보관이 먼저다 — 리스너 전달이 유실돼도 다음 구독이 살린다.
      pending = clean;
      listener?.(clean);
    },
    subscribe(onCode: Listener) {
      listener = onCode;
      // 보관분은 지우지 않고 전달만 한다 — 소비는 화면이 알려온다.
      if (pending) onCode(pending);
      return () => {
        if (listener === onCode) listener = null;
      };
    },
    clear() {
      pending = null;
    },
  };
}

const house = channel();
const friend = channel();

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

// --- 친구 초대 채널 (#667) — 같은 계약, 목적지만 친구 초대 화면. ---

export function setPendingFriendInviteCode(code: string) {
  friend.set(code);
}

/** 셸이 마운트에서 1회 구독 — 해제 함수를 돌려준다. */
export function subscribePendingFriendInviteCode(onCode: Listener): () => void {
  return friend.subscribe(onCode);
}

/** 친구 초대 화면이 코드 프리필을 반영했을 때. */
export function clearPendingFriendInviteCode() {
  friend.clear();
}
