import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NULLABLE_OVERRIDES } = require('../../../scripts/gen-api-types.js') as {
  NULLABLE_OVERRIDES: Record<string, Record<string, string>>;
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
