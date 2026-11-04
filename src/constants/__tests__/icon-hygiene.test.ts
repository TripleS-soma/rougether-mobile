import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS = join(__dirname, '..', '..', 'components');

/**
 * 컴포넌트 코드에 이모지·텍스트 기호를 아이콘으로 쓰지 않는다 (#1613).
 * 이모지는 OS마다 그림이 다르고 테마색을 못 받으며, `›` `▲` `＋` 같은 기호는
 * 선택 폰트에 글리프가 없으면 폴백 폰트로 튄다. 아이콘은 `Icon`(Ionicons)으로.
 *
 * 문구 안의 이모지(i18n 리소스)나 사용자 콘텐츠는 대상이 아니다 — 여기서는
 * 컴포넌트 소스에 직접 박힌 글자만 본다. 주석은 지우고 검사한다.
 */
const FORBIDDEN = /[\p{Extended_Pictographic}‹›＋▲▼]/u;

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

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('icon hygiene', () => {
  it('has no emoji or text-symbol icons in component source', () => {
    const offenders: string[] = [];
    for (const path of sourceFiles(COMPONENTS)) {
      stripComments(readFileSync(path, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          if (FORBIDDEN.test(line)) {
            offenders.push(`${path.replace(`${COMPONENTS}/`, 'src/components/')}:${i + 1}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
