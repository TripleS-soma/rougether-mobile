/**
 * 본문 속 웹 주소 찾기 (#1507) — 채팅·피드 글·댓글의 링크를 누를 수 있게.
 *
 * `http(s)://…`와 `www.…`만 링크로 본다. 이메일·전화번호·맨 도메인(`example.com`)은 오탐이
 * 많아 제외한다. 문장 끝에 붙은 구두점·닫는 괄호는 주소에서 뺀다("여기 봐: https://a.com/x."의
 * 마침표). 괄호는 짝이 맞을 때만 주소에 남긴다(위키 `…/Foo_(bar)`).
 */
export type TextSegment =
  { kind: 'text'; text: string } | { kind: 'link'; text: string; url: string };

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
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
 * 확인 창에 보여 줄 호스트 — RN의 `URL`은 `host` 등을 구현하지 않는 버전이 있어 직접 뽑는다.
 * 못 뽑으면 주소 그대로.
 */
export function linkHost(url: string): string {
  const m = /^https?:\/\/([^/?#\s]+)/i.exec(url);
  return m ? m[1].replace(/^[^@]*@/, '') : url;
}
