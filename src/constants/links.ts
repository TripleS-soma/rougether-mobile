/**
 * 공개 웹 링크 (#624 초대 링크) — 커스텀 도메인 rougether.com (#809).
 * TripleS-soma/rougether-landing 레포가 GitHub Pages로 서빙한다.
 *
 * 옛 주소(`…github.io/rougether-landing`)는 Pages가 이 도메인으로 301
 * 리다이렉트하므로, 이미 공유된 초대 링크도 계속 열린다.
 */
export const LANDING_BASE_URL = 'https://rougether.com';

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
