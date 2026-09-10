/**
 * 붙여넣은 글에서 초대코드를 찾는다 (#1007).
 *
 * 설치 전에 초대 링크를 누른 사람은 앱을 깔고 나면 코드를 잃는다. 랜딩이 코드를
 * 클립보드에 넣어 두고, 앱이 온보딩 직후 붙여넣기 버튼으로 받는다. 들어오는 모양은
 * 셋이다:
 *
 * - 봉투 `rougether-invite:{friend|house}:{CODE}` — 서버 랜딩(`/i`·`/h`)이 복사하는
 *   계약 문자열(rougether-server `docs/claude/domains/invite.md`).
 * - 초대 링크 — 친구가 보낸 메시지를 통째로 복사한 경우(`…/invite.html?code=`,
 *   `…/join.html?code=`, `rougether://invite|join?code=`, `rougether…/i/{CODE}`·`/h/{CODE}`).
 * - 코드만 — rougether.com 랜딩의 '초대코드 복사' 버튼은 코드만 넣는다.
 *
 * **코드만 받는 건 사용자가 직접 붙여넣었을 때만 안전하다.** 자동으로 읽은 클립보드에
 * 적용하면 우연히 복사해 둔 영문·숫자 조각을 초대코드로 오인한다. 어느 경우든
 * 사용 전에 미리보기(`GET /invites/by-code`)로 검증하므로 여기서는 모양만 본다.
 */

export type InviteKind = 'friend' | 'house';
export type ParsedInvite = { kind: InviteKind; code: string };

/** 코드 모양 — 서버 발급 문자 집합(영문 대문자·숫자). 길이는 넉넉히. */
const CODE_RE = /^[A-Z0-9]{4,16}$/;

const ENVELOPE_RE = /rougether-invite:(friend|house):([A-Za-z0-9]+)/i;
const SCHEME_RE = /rougether:\/\/(invite|join)\?(?:[^\s#]*&)?code=([A-Za-z0-9]+)/i;
const LANDING_PAGE_RE = /\/(invite|join)\.html\?(?:[^\s#]*&)?code=([A-Za-z0-9]+)/i;
// 서버 랜딩 `/i/{CODE}`·`/h/{CODE}` — 흔한 경로라 호스트에 rougether가 있을 때만.
const SHORT_LINK_RE = /https?:\/\/[^\s/]*rougether[^\s/]*\/(i|h)\/([A-Za-z0-9]+)/i;

function normalize(code: string): string | null {
  const clean = code.trim().toUpperCase();
  return CODE_RE.test(clean) ? clean : null;
}

function found(kind: InviteKind, code: string): ParsedInvite | null {
  const clean = normalize(code);
  return clean ? { kind, code: clean } : null;
}

export function parseInviteText(raw: string | null | undefined): ParsedInvite | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  const envelope = text.match(ENVELOPE_RE);
  if (envelope) return found(envelope[1].toLowerCase() as InviteKind, envelope[2]);

  const scheme = text.match(SCHEME_RE);
  if (scheme) return found(scheme[1].toLowerCase() === 'join' ? 'house' : 'friend', scheme[2]);

  const page = text.match(LANDING_PAGE_RE);
  if (page) return found(page[1].toLowerCase() === 'join' ? 'house' : 'friend', page[2]);

  const short = text.match(SHORT_LINK_RE);
  if (short) return found(short[1].toLowerCase() === 'h' ? 'house' : 'friend', short[2]);

  // 코드만 — 글 전체가 공백 없는 한 덩어리여야 한다. 공백을 지워 이어 붙이면
  // "hello world"가 코드 모양이 돼 버린다. 친구 초대 랜딩이 복사하는 것이므로
  // 친구 코드로 본다.
  if (/\s/.test(text)) return null;
  return found('friend', text);
}
