/**
 * 초대 링크 딥링크 핸드오프 (#624) — `rougether://join?code=…`로 열린 join
 * 라우트가 코드를 맡기고, 앱 셸이 구독해 집 탐색의 코드 입장 플로우로 잇는다.
 * 콜드 스타트(셸이 나중에 마운트)와 웜 스타트(셸이 이미 떠 있음) 모두:
 * 구독 시점에 보관분을 즉시 전달하고, 이후 도착분은 리스너로 바로 흐른다.
 * 로그인 전에 열린 링크는 보관됐다가 로그인 후 셸 마운트 때 소비된다.
 */

let pending: string | null = null;
let listener: ((code: string) => void) | null = null;

export function setPendingInviteCode(code: string) {
  const clean = code.trim().toUpperCase();
  if (!clean) return;
  if (listener) listener(clean);
  else pending = clean;
}

/** 셸이 마운트에서 1회 구독 — 해제 함수를 돌려준다. */
export function subscribePendingInviteCode(onCode: (code: string) => void): () => void {
  listener = onCode;
  if (pending) {
    const code = pending;
    pending = null;
    onCode(code);
  }
  return () => {
    if (listener === onCode) listener = null;
  };
}

// --- 친구 초대 채널 (#667) — 같은 핸드오프 계약, 목적지만 친구 초대 화면. ---

let pendingFriend: string | null = null;
let friendListener: ((code: string) => void) | null = null;

export function setPendingFriendInviteCode(code: string) {
  const clean = code.trim().toUpperCase();
  if (!clean) return;
  if (friendListener) friendListener(clean);
  else pendingFriend = clean;
}

/** 셸이 마운트에서 1회 구독 — 해제 함수를 돌려준다. */
export function subscribePendingFriendInviteCode(onCode: (code: string) => void): () => void {
  friendListener = onCode;
  if (pendingFriend) {
    const code = pendingFriend;
    pendingFriend = null;
    onCode(code);
  }
  return () => {
    if (friendListener === onCode) friendListener = null;
  };
}
