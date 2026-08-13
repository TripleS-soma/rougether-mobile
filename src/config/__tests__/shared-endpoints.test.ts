import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { API_BASE } from '@/api/config';
import sharedEndpoints from '@/config/shared-endpoints.json';
import { RESOURCE_BASE } from '@/resources/asset';

const SRC = join(__dirname, '..', '..');

/**
 * 생성물의 출처 헤더는 예외 — `gen:api-types`가 "이 스펙에서 뽑았다"고 적어
 * 두는 주석이라 두 번째 진실 공급원이 아니다.
 */
const ALLOWED = new Set(['src/api/types.ts']);

/** src 아래 모든 .ts/.tsx (자기 자신인 config·테스트는 제외). */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'config') sourceFiles(p, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * 공용 환경 주소의 단일 출처 (#738) — API·에셋·스펙 주소는 이 JSON 하나에만
 * 있어야 한다. 같은 값을 코드에 또 박아 두면 CDN을 옮길 때 한쪽만 따라가고,
 * "API는 되는데 이미지만 전부 안 뜬다" 같은 형태로 늦게 드러난다 (#780).
 */
describe('shared-endpoints 단일 출처 (#738)', () => {
  it('env 미설정 시 폴백이 공용 주소를 그대로 쓴다', () => {
    // 테스트 환경엔 EXPO_PUBLIC_* 이 없으므로 폴백 경로가 그대로 보인다.
    expect(API_BASE).toBe(sharedEndpoints.apiBase.replace(/\/+$/, ''));
    expect(RESOURCE_BASE).toBe(sharedEndpoints.assetBase.replace(/\/+$/, ''));
  });

  it('같은 호스트를 src 안에 다시 하드코딩하지 않는다', () => {
    const hosts = [...new Set(Object.values(sharedEndpoints).map((u) => new URL(u).origin))];
    const offenders = sourceFiles(SRC)
      .map((p) => [p.replace(`${SRC}/`, 'src/'), readFileSync(p, 'utf8')] as const)
      .filter(([rel]) => !ALLOWED.has(rel))
      .flatMap(([rel, text]) => hosts.filter((h) => text.includes(h)).map((h) => `${rel} → ${h}`));

    expect(offenders).toEqual([]);
  });
});
