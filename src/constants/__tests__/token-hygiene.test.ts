import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Radius, Spacing } from '@/constants/theme';

const SRC = join(__dirname, '..', '..');

/**
 * 스캔 제외 — 토큰 정의 자체, 그리고 토큰을 쓸 수 없는 표면.
 * `widgets/`는 RemoteViews라 훅·토큰 접근이 없고(파일 상단에 명시), `dev/`는
 * 갤러리 데모 값이다.
 */
const EXEMPT = [/^src\/constants\/theme\.ts$/, /^src\/widgets\//, /^src\/dev\//];

const SPACING_BY_VALUE = new Map(Object.entries(Spacing).map(([k, v]) => [v as number, k]));
const RADIUS_BY_VALUE = new Map(Object.entries(Radius).map(([k, v]) => [v as number, k]));

const PROP = /\b(padding\w*|margin\w*|gap|rowGap|columnGap|borderRadius)\s*:\s*(\d+)/g;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') sourceFiles(p, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * 간격·모서리는 토큰에서 (AGENTS.md) — 토큰과 **값이 똑같은데** 숫자로 쓴 곳을
 * 잡는다 (#781). 스케일 밖 값(원형 버튼 반지름, 헤어라인 등)은 토큰으로 표현할
 * 수 없으므로 건드리지 않는다.
 */
describe('토큰 위생 — 간격·모서리 (#781)', () => {
  it('토큰과 값이 같은 숫자를 직접 쓰지 않는다', () => {
    const offenders: string[] = [];

    for (const path of sourceFiles(SRC)) {
      const rel = path.replace(`${SRC}/`, 'src/');
      if (EXEMPT.some((re) => re.test(rel))) continue;

      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.trim().startsWith('//')) return;
          for (const m of line.matchAll(PROP)) {
            const value = Number(m[2]);
            const token =
              m[1] === 'borderRadius' ? RADIUS_BY_VALUE.get(value) : SPACING_BY_VALUE.get(value);
            if (token) {
              const ns = m[1] === 'borderRadius' ? 'Radius' : 'Spacing';
              offenders.push(`${rel}:${i + 1}  ${m[0]} → ${ns}.${token}`);
            }
          }
        });
    }

    expect(offenders).toEqual([]);
  });
});
