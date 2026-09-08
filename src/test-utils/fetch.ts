/**
 * fetch 응답 빌더 — 훅 테스트 15개가 각자 들고 있던 `res()`의 단일 출처.
 * API 클라이언트(`src/api/client.ts`)가 읽는 최소 모양만 만든다: `ok`·`status`·`text()`.
 */
export type FetchLikeResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

/** `status < 400`이면 ok. 본문은 JSON 문자열로. */
export function jsonRes(body: unknown, status = 200): FetchLikeResponse {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) };
}
