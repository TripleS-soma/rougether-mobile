import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NULLABLE_OVERRIDES, NAMED_ALIASES } = require('../../../scripts/gen-api-types.js') as {
  NULLABLE_OVERRIDES: Record<string, Record<string, string>>;
  NAMED_ALIASES: Record<string, string>;
};

/**
 * 스펙 미표기 nullable 계약 (#733) — 서버 스펙엔 nullable이 없지만 실제로는
 * null이 오는 필드들. 생성기가 매번 덮어써 수동 패치가 조용히 사라지던 자리라,
 * 생성물이 오버라이드 목록과 어긋나면 여기서 잡는다.
 */
describe('스펙 미표기 nullable 오버라이드 (#733)', () => {
  const source = readFileSync(join(__dirname, '..', 'types.ts'), 'utf8');

  /** `export type X = { … };` 한 덩어리를 떼어낸다. */
  const blockOf = (typeName: string) => {
    const start = source.indexOf(`export type ${typeName} = {`);
    expect(start).toBeGreaterThan(-1);
    return source.slice(start, source.indexOf('\n};', start));
  };

  const cases = Object.entries(NULLABLE_OVERRIDES).flatMap(([typeName, fields]) =>
    Object.keys(fields).map((field) => [typeName, field] as const),
  );

  it.each(cases)('%s.%s 은 생성물에서 nullable이다', (typeName, field) => {
    const block = blockOf(typeName);
    // `field?:`(optional)와 `field:`(required) 둘 다 잡는다 — 지금 8개는 전부
    // optional이지만, required 필드에 override가 붙으면 못 찾아 헛발 실패한다.
    const line = block.split('\n').find((l) => new RegExp(`^${field}\\??:`).test(l.trim()));
    expect(line).toBeDefined();
    expect(line).toMatch(/\| null;$/);
  });

  it('오버라이드가 비어 있지 않다 — 목록째 사라지는 회귀 방지', () => {
    expect(cases.length).toBeGreaterThanOrEqual(8);
  });
});

/**
 * 앱 별칭 (#1412) — 서버가 인라인으로 둔 enum·바뀐 응답 이름을 앱이 쓰던 이름으로
 * 생성 스키마에서 파생한다. 손으로 types.ts에 적었다가 재생성 때 사라져 tsc가
 * 34건 깨졌던 자리라, 생성물에 별칭이 그대로 실렸는지 확인한다.
 */
describe('생성기 앱 별칭 (#1412)', () => {
  const source = readFileSync(join(__dirname, '..', 'types.ts'), 'utf8');

  it.each(Object.entries(NAMED_ALIASES))('%s 별칭이 생성물에 있다', (alias, target) => {
    expect(source).toContain(`export type ${alias} = ${target};`);
  });
});
