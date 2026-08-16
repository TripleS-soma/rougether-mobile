import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');

/**
 * 스캔 제외 — 토큰 위생(#781)과 같은 기준.
 * `widgets/`는 SwiftUI/RemoteViews라 앱 폰트를 쓸 수 없고, `dev/`는 갤러리다.
 */
const EXEMPT = [/^src\/widgets\//, /^src\/dev\//];

/**
 * 폰트가 붙는 경로 — 하나라도 있으면 선택 폰트를 따른다.
 * `Typography.*`는 `useTypography()`가 준 스케일(롤별 fontFamily 포함),
 * `emph()`는 `useFontEmphasis()`(커스텀 폰트면 패밀리, 시스템이면 fontWeight),
 * `displayFace`/`fontPreview`는 폰트 미리보기 전용 헬퍼다.
 */
const FONT_SOURCES = ['Typography', 'emph(', 'displayFace', 'fontPreview', 'fontFamily'];

/**
 * 글리프 전용 예외 — 본문 텍스트가 아니라 기호·이모지를 그리는 스타일.
 * `›` `‹` `＋` 같은 문자는 한글 웹폰트에 없을 수 있어 패밀리를 강제하면
 * 오히려 폴백이 더 튄다. 파일+스타일 키로 적어 줄 이동에 흔들리지 않게 한다.
 */
const GLYPH_ONLY: Record<string, string[]> = {
  'src/components/ui/mission-banner.tsx': ['emoji'],
  'src/components/ui/calendar.tsx': ['navGlyph'],
  'src/components/screens/add-routine-screen.tsx': ['chevron'],
  'src/components/screens/routine-manage-screen.tsx': ['chevron'],
  'src/components/screens/category-manage-screen.tsx': ['moveGlyph'],
  'src/components/screens/settings/appearance-preview.tsx': ['avatarGlyph', 'addGlyph'],
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') sourceFiles(p, out);
    } else if (entry.name.endsWith('.tsx')) {
      out.push(p);
    }
  }
  return out;
}

/** `const X = [Typography.body, emph('bold'), styles.y]` 처럼 폰트를 품은 스타일 변수. */
function safeStyleVars(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(/const (\w+)\s*=\s*\[([^\];]*)\]/gs)) {
    if (FONT_SOURCES.some((k) => m[2].includes(k))) out.add(m[1]);
  }
  return out;
}

/** fontSize는 있는데 fontFamily가 없는 StyleSheet 키 — 그대로 쓰면 시스템 폰트다. */
function fontlessStyleKeys(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(/(\w+)\s*:\s*\{([^{}]*)\}/g)) {
    if (m[2].includes('fontSize') && !m[2].includes('fontFamily')) out.add(m[1]);
  }
  return out;
}

/**
 * 앱 폰트 선택(#382)이 화면 전체에 닿는지 지킨다.
 *
 * 설정에서 폰트를 바꿔도 안 바뀌는 글자가 있다는 제보로 전수 조사한 결과,
 * 로컬 StyleSheet에 `fontSize`만 적고 패밀리를 안 준 텍스트가 21곳 있었다
 * (로그인 화면 부제·에러 문구 포함 — 첫 화면부터 두 폰트가 섞여 있었다).
 *
 * 원인이 "새 화면에서 fontSize만 적고 넘어감"이라 리뷰로는 계속 샌다.
 * 여기서 막는다.
 */
describe('폰트 위생 — 선택 폰트가 모든 텍스트에 닿는가 (#382)', () => {
  it('타이포 스케일도 emph()도 거치지 않는 <Text>가 없다', () => {
    const offenders: string[] = [];

    for (const path of sourceFiles(SRC)) {
      const rel = path.replace(`${SRC}/`, 'src/');
      if (EXEMPT.some((re) => re.test(rel))) continue;

      const source = readFileSync(path, 'utf8');
      if (!source.includes('<Text')) continue;

      const safeVars = safeStyleVars(source);
      const fontless = fontlessStyleKeys(source);
      const allowed = GLYPH_ONLY[rel] ?? [];

      for (const m of source.matchAll(/<Text(\s[^>]*?)?>/gs)) {
        const attrs = m[1] ?? '';
        const before = source.slice(0, m.index);

        // 중첩 <Text>는 부모의 폰트를 상속한다 — 부모만 지키면 된다.
        const depth =
          (before.match(/<Text[\s>]/g) ?? []).length - (before.match(/<\/Text>/g) ?? []).length;
        if (depth > 0) continue;

        if (FONT_SOURCES.some((k) => attrs.includes(k))) continue;
        if ([...safeVars].some((v) => attrs.includes(v))) continue;

        const used = [...attrs.matchAll(/styles\.(\w+)/g)].map((s) => s[1]);
        const bad = used.filter((k) => fontless.has(k));
        // 스타일 키가 붙어 있고 그중 폰트 없는 게 없으면 통과.
        if (used.length > 0 && bad.length === 0) continue;
        if (bad.every((k) => allowed.includes(k)) && bad.length > 0) continue;

        const line = before.split('\n').length;
        offenders.push(`${rel}:${line}  ${used.length ? `styles.${used.join(',')}` : '(인라인)'}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
