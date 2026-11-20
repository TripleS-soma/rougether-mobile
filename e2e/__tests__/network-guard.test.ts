import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SPECS = join(__dirname, '..', 'specs');

/**
 * 웹 E2E는 운영 서버에 요청을 보내면 안 된다. 그물(`networkGuard`)과 `mockApi`는
 * `e2e/support/app.ts`의 `test`에만 걸려 있으니, 스펙이 `@playwright/test`의 `test`를
 * 직접 쓰면 그물 없이 실제 서버로 나간다. 그래서 스펙은 공용 `test`만 쓰게 한다.
 */
describe('E2E 스펙의 네트워크 그물', () => {
  const specs = readdirSync(SPECS).filter((f) => f.endsWith('.e2e.ts'));

  it('스펙이 하나 이상 있다', () => {
    expect(specs.length).toBeGreaterThan(0);
  });

  it.each(specs)('%s는 공용 test(../support/app)만 쓴다', (file) => {
    const source = readFileSync(join(SPECS, file), 'utf8');
    expect(source).toMatch(/from '\.\.\/support\/app'/);
    expect(source).not.toMatch(/from '@playwright\/test'/);
  });
});
