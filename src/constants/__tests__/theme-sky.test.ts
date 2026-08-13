import { SKY_BY_PHASE, skyPhaseForHour } from '@/constants/theme';

describe('skyPhaseForHour (#358)', () => {
  it('경계값이 새벽/낮/노을/밤으로 나뉜다', () => {
    expect(skyPhaseForHour(4)).toBe('night');
    expect(skyPhaseForHour(5)).toBe('dawn');
    expect(skyPhaseForHour(7)).toBe('dawn');
    expect(skyPhaseForHour(8)).toBe('day');
    expect(skyPhaseForHour(16)).toBe('day');
    expect(skyPhaseForHour(17)).toBe('sunset');
    expect(skyPhaseForHour(19)).toBe('sunset');
    expect(skyPhaseForHour(20)).toBe('night');
    expect(skyPhaseForHour(0)).toBe('night');
  });

  it('낮 하늘은 기존 sky 토큰과 동일 값이라 낮 시간의 모습이 변하지 않는다', () => {
    expect(SKY_BY_PHASE.light.day).toBe('#C3E0F5');
    expect(SKY_BY_PHASE.dark.day).toBe('#2A3448');
  });
});
