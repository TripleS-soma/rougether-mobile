/**
 * 공개 웹(GitHub Pages) 링크 (#624 초대 링크) — 랜딩 레포
 * TripleS-soma/rougether-landing가 서빙한다. 커스텀 도메인이 생기면 여기만 바꾼다.
 */
export const LANDING_BASE_URL = 'https://triples-soma.github.io/rougether-landing';

/**
 * 집 초대 링크 — 메신저에서 눌리도록 https(랜딩 경유)로 만든다. 랜딩 join
 * 페이지가 `rougether://join?code=…` 딥링크로 앱을 열고, 미설치면 설치 안내.
 */
export function houseInviteLink(code: string): string {
  return `${LANDING_BASE_URL}/join.html?code=${encodeURIComponent(code)}`;
}

/**
 * 친구 초대 링크 (#667) — 랜딩 invite 페이지가 `rougether://invite?code=…`
 * 딥링크로 앱을 열어 설정 → 친구 초대의 코드 입력으로 잇는다.
 */
export function friendInviteLink(code: string): string {
  return `${LANDING_BASE_URL}/invite.html?code=${encodeURIComponent(code)}`;
}
