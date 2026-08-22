import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');

/** 스캔 제외 — 사용자에게 안 보이는 것들. */
const EXEMPT = [/^src\/dev\//, /^src\/mocks\//, /__tests__/];

/**
 * 한글 음절·ASCII 말고 UI 문구에 써도 되는 문자. **사유를 반드시 적는다.**
 *
 * 여기 없는 문자를 쓰려면 먼저 `assets/fonts`의 네 폰트에 그 글리프가 있는지
 * 확인하고 이 목록에 추가하세요. 확인 방법은 `docs`가 아니라 이 파일 위 주석에
 * 적힌 이유를 보면 됩니다 — 없는 글리프는 **시스템 폰트로 폴백**돼, 한 줄
 * 안에서 한글은 선택 폰트로 부호만 다른 서체로 나옵니다 (#965).
 */
const ALLOWED: Record<string, string> = {
  '·': '명사 나열(루틴·할 일). Jua만 없고 나머지 3종이 제대로 그려 — 바꾸면 잘 나오던 쪽이 나빠진다 (#965).',
  '“': '인용부호. 네 폰트 모두 있다 (작은따옴표 ‘ ’ 는 Jua에 없어 이걸 쓴다).',
  '”': '인용부호. 네 폰트 모두 있다.',
};

/** 이모지는 텍스트 폰트가 아니라 시스템 이모지 폰트로 그려진다 — 커버리지 대상이 아니다. */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

/** 주석을 지운다 — 이 저장소 주석은 한국어에 `—`·`…`를 자주 쓰는데 렌더되지 않는다. */
function stripComments(s: string): string {
  let out = '';
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      for (; j < s.length; j++) {
        if (s[j] === '\\') j++;
        else if (s[j] === c) break;
      }
      out += s.slice(i, j + 1);
      i = j + 1;
    } else if (s.startsWith('//', i)) {
      const j = s.indexOf('\n', i);
      i = j < 0 ? s.length : j;
    } else if (s.startsWith('/*', i)) {
      const j = s.indexOf('*/', i);
      i = j < 0 ? s.length : j + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.tsx?$/.test(p) && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const LITERAL = /(['"])((?:\\.|(?!\1).)*)\1|`((?:\\.|[^`])*)`|>([^<>{}]*)</gs;

/**
 * UI 문구가 커스텀 폰트로 그려지는지 지킨다 (#965).
 *
 * #893(영어 지원) 조사 중 폰트 cmap을 전수 대조하다, 커스텀 폰트에 없는
 * 문장부호가 22곳에서 시스템 폰트로 폴백되고 있는 걸 발견했다 — `—`는 Jua·SUIT
 * 둘 다 없어 5종 중 2종에서 서체가 튀었다. tofu가 아니라 폴백이라 눈에 잘 안
 * 띄고, 그래서 리뷰로는 계속 샌다. 여기서 막는다.
 */
describe('글리프 위생 — UI 문구가 커스텀 폰트 안에 있는가 (#965)', () => {
  const files = sourceFiles(SRC).filter(
    (p) => !EXEMPT.some((re) => re.test(p.replace(`${SRC}/`, 'src/'))),
  );

  it('스캔 대상 파일이 실제로 존재한다', () => {
    // 경로가 바뀌어 0개를 스캔하면서 조용히 통과하는 걸 막는다.
    expect(files.length).toBeGreaterThan(100);
  });

  it('허용 목록 밖의 문자가 UI 문구에 없다', () => {
    const offenders: string[] = [];

    for (const path of files) {
      const rel = path.replace(`${SRC}/`, 'src/');
      const code = stripComments(readFileSync(path, 'utf8'));

      for (const m of code.matchAll(LITERAL)) {
        const text = m[2] ?? m[3] ?? m[4] ?? '';
        if (!HANGUL.test(text)) continue; // UI 문구만 본다
        for (const ch of new Set(text)) {
          const cp = ch.codePointAt(0) ?? 0;
          if (cp < 0x80 || HANGUL.test(ch)) continue;
          if (ch in ALLOWED || EMOJI.test(ch)) continue;
          const line = code.slice(0, m.index).split('\n').length;
          offenders.push(
            `${rel}:${line}  ${ch} (U+${cp.toString(16).toUpperCase()})  ${text.slice(0, 40)}`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('허용 목록에 사유가 빠진 항목이 없다', () => {
    expect(Object.entries(ALLOWED).filter(([, why]) => why.trim().length < 10)).toEqual([]);
  });
});
