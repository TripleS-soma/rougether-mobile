const { checkTrain, compareVersions, findShippedVersion } = require('../check-version-train');

describe('check-version-train (iOS 버전 트레인 가드)', () => {
  it('semver를 숫자로 비교한다 — 1.10.0 > 1.9.1', () => {
    expect(compareVersions('1.10.0', '1.9.1')).toBe(1);
    expect(compareVersions('1.3.0', '1.3.0')).toBe(0);
    expect(compareVersions('1.3', '1.3.1')).toBe(-1);
  });

  it('스토어(STORE) FINISHED 빌드 중 최고 버전만 본다', () => {
    expect(
      findShippedVersion([
        { appVersion: '1.3.0', status: 'FINISHED', distribution: 'STORE' },
        { appVersion: '1.9.0', status: 'FINISHED', distribution: 'INTERNAL' }, // preview는 무시
        { appVersion: '2.0.0', status: 'ERRORED', distribution: 'STORE' }, // 실패 빌드 무시
        { appVersion: '1.2.0', status: 'FINISHED', distribution: 'STORE' },
      ]),
    ).toBe('1.3.0');
  });

  it('같은 버전이면 막는다 — 2026-09-03 1.3.0 재빌드 사고', () => {
    const r = checkTrain('1.3.0', [
      { appVersion: '1.3.0', status: 'FINISHED', distribution: 'STORE' },
    ]);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('1.3.0');
    expect(r.message).toContain('app.json version을 올리세요');
  });

  it('높은 버전이면 통과, 스토어 정보가 없으면 통과(가드가 배포를 막지 않는다)', () => {
    expect(
      checkTrain('1.4.0', [{ appVersion: '1.3.0', status: 'FINISHED', distribution: 'STORE' }]).ok,
    ).toBe(true);
    expect(checkTrain('1.3.0', []).ok).toBe(true);
    expect(checkTrain('1.3.0', null).ok).toBe(true);
  });
});
