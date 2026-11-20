/** 고정 응답 공통 — 모든 시각은 테스트 시계(2026-11-19T03:00:00Z = KST 12:00) 기준. */
export const NOW_ISO = '2026-11-19T03:00:00Z';
/** KST 달력 날짜 — 시계와 같은 날. */
export const TODAY = '2026-11-19';
export const E2E_USER_ID = 9001;
export const HOUSE_ID = 501;

/** 목록 응답 봉투. */
export type List<T> = { items: T[] };

/** 1×1 투명 PNG — 사진 바이트를 주는 엔드포인트와 이미지 CDN 응답. */
export const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
