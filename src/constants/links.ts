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
