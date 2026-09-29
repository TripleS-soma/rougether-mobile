/**
 * 요청 멱등 키용 UUID(v4) — 인증 수단이 아니다. `crypto.randomUUID`가 있으면(웹·Hermes 최신)
 * 그걸, 없으면 Math.random으로 v4 모양을 만든다. 서버(거래소 #1427)가 UUID 정규식으로
 * 검증하므로 폴백도 8-4-4-4-12 형식을 지킨다.
 *
 * TODO: 같은 구현이 `hooks/feed-cache`(newFeedClientId)·`hooks/use-house-chat`·
 * `hooks/use-furniture-studio`에도 있다 — 그 파일을 만질 때 이걸로 옮긴다(AGENTS.md: 통째 리라이트 금지).
 */
export function newRequestId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const n = Math.floor(Math.random() * 16);
    return (ch === 'x' ? n : (n & 3) | 8).toString(16);
  });
}
