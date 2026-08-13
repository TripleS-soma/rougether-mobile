import { missionCtaState } from '@/utils/mission-cta';

const base = { contributed: false, linked: false, canClaim: true, canAddRoutine: true };

// 상태 조합 표 (#559) — 렌더 삼항 체인이 하던 결정과 1:1.
describe('missionCtaState (#559)', () => {
  it.each([
    ['COMPLETED는 항상 완료 라벨', { ...base, status: 'COMPLETED', achieved: true }, 'completed'],
    ['EXPIRED는 항상 만료 라벨', { ...base, status: 'EXPIRED', achieved: true }, 'expired'],
    ['ACTIVE+달성+배선 → 보상 받기', { ...base, status: 'ACTIVE', achieved: true }, 'claim'],
    [
      'ACTIVE+달성이라도 배선 없으면 다음 가지로',
      { ...base, status: 'ACTIVE', achieved: true, canClaim: false, contributed: true },
      'contributed',
    ],
    ['ACTIVE+오늘 기여 → 기여함', { ...base, status: 'ACTIVE', contributed: true }, 'contributed'],
    ['ACTIVE+연동만 → 루틴 연동됨', { ...base, status: 'ACTIVE', linked: true }, 'linked'],
    ['ACTIVE 기본 → 내 루틴에 추가', { ...base, status: 'ACTIVE' }, 'addRoutine'],
    [
      'ACTIVE인데 추가 배선도 없으면 무표시',
      { ...base, status: 'ACTIVE', canAddRoutine: false },
      'none',
    ],
  ] as const)('%s', (_name, input, expected) => {
    expect(missionCtaState(input).kind).toBe(expected);
  });

  it('우선순위: 보상 받기 > 기여함 > 연동됨 > 추가', () => {
    expect(
      missionCtaState({
        ...base,
        status: 'ACTIVE',
        achieved: true,
        contributed: true,
        linked: true,
      }).kind,
    ).toBe('claim');
    expect(
      missionCtaState({ ...base, status: 'ACTIVE', contributed: true, linked: true }).kind,
    ).toBe('contributed');
  });
});
