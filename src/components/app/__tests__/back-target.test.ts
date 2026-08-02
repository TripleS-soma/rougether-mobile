import { backTargetFor } from '@/components/app/app-shell';

// 하드웨어 백(#522)과 iOS 엣지 백(#564)이 공유하는 뒤로 목적지 규칙.
describe('backTargetFor (#564)', () => {
  it('서브화면은 백맵 목적지로', () => {
    expect(backTargetFor('help', 'routineManage', false)).toBe('settings');
    expect(backTargetFor('friendRoom', 'routineManage', false)).toBe('house');
    expect(backTargetFor('decor', 'routineManage', false)).toBe('myRoom');
  });

  it('addRoutine은 연 곳으로 돌아간다', () => {
    expect(backTargetFor('addRoutine', 'myRoom', false)).toBe('myRoom');
    expect(backTargetFor('addRoutine', 'routineManage', false)).toBe('routineManage');
  });

  it('집 없는 유저의 탐색은 빈 집 화면 대신 나의 방으로 (#571)', () => {
    expect(backTargetFor('houseSearch', 'routineManage', true)).toBe('myRoom');
    expect(backTargetFor('houseSearch', 'routineManage', false)).toBe('house');
  });

  it('루트(나의 방)는 목적지 없음', () => {
    expect(backTargetFor('myRoom', 'routineManage', false)).toBeNull();
  });
});
