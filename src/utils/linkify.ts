/**
 * 본문 속 웹 주소 찾기 (#1507) — 채팅·피드 글·댓글의 링크를 누를 수 있게.
 *
 * `http(s)://…`와 `www.…`만 링크로 본다. 이메일·전화번호·맨 도메인(`example.com`)은 오탐이
 * 많아 제외한다. 문장 끝에 붙은 구두점·닫는 괄호는 주소에서 뺀다("여기 봐: https://a.com/x."의
 * 마침표). 괄호는 짝이 맞을 때만 주소에 남긴다(위키 `…/Foo_(bar)`).
 */
export type TextSegment =
  { kind: 'text'; text: string } | { kind: 'link'; text: string; url: string };

// 한글(완성형·자모)은 주소 문자로 보지 않는다 — 한국어 채팅은 `https://a.com/x에서`·`www.a.com도`처럼
// 조사를 바로 붙이는 일이 흔하고, 그대로 삼키면 404 주소에 확인 창 도메인까지 틀린다(#1508 리뷰).
// 대가로 경로에 한글이 그대로 든 주소(`namu.wiki/w/한글`)는 한글 앞에서 끊긴다 — 한글 도메인(IDN)도 범위 밖.
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'\uAC00-\uD7A3\u3131-\u318E]+/gi;
const TRAILING = /[.,!?;:'"…。、)\]}>]+$/;

function trimTrailing(raw: string): string {
  let s = raw.replace(TRAILING, '');
  // 짝이 맞는 닫는 괄호는 되돌린다 — `…/Foo_(bar)`.
  const removed = raw.slice(s.length);
  for (const ch of removed) {
    if (ch !== ')') break;
    const opens = (s.match(/\(/g) ?? []).length;
    const closes = (s.match(/\)/g) ?? []).length;
    if (opens > closes) s += ch;
    else break;
  }
  return s;
}

/** 본문을 글자·링크 조각으로 나눈다. 링크가 없으면 글자 조각 하나. */
export function splitLinks(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_PATTERN)) {
    const start = m.index ?? 0;
    const raw = trimTrailing(m[0]);
    // 'www.'만 덩그러니 남은 경우 등 — 링크로 보지 않는다.
    if (raw.length <= 'www.'.length || /^https?:\/\/$/i.test(raw)) continue;
    if (start > last) out.push({ kind: 'text', text: text.slice(last, start) });
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    out.push({ kind: 'link', text: raw, url });
    last = start + raw.length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out.length > 0 ? out : [{ kind: 'text', text }];
}

/**
 * 확인 창에 보여 줄 호스트 — 피싱 방지용이라 **브라우저가 실제로 여는 곳**과 같아야 한다.
 * RN의 `URL`은 `host` 등을 구현하지 않는 버전이 있어 직접 뽑되, WHATWG URL 규칙을 따른다:
 * - http(s)에서 백슬래시는 슬래시와 같은 구분자다 — `https://evil.com\\@google.com/`은 evil.com을
 *   연다(#1508 리뷰: 예전 정규식은 google.com을 보여 줬다).
 * - 사용자 정보(`user:pw@`)는 **마지막** `@`까지다 — `a@b@evil.com`의 호스트는 evil.com.
 * 못 뽑으면 주소 그대로.
 */
export function linkHost(url: string): string {
  const m = /^https?:\/\/([^/\\?#\s]*)/i.exec(url);
  if (!m) return url;
  const authority = m[1];
  return authority.slice(authority.lastIndexOf('@') + 1) || url;
}
