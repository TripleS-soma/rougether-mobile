import { backTargetFor } from '@/components/app/app-shell';
import { FULL_SWIPE_BACK_EXCLUDED } from '@/components/app/navigation';

// 하드웨어 백(#522)과 iOS 엣지 백(#564)이 공유하는 뒤로 목적지 규칙.
describe('backTargetFor (#564)', () => {
  it('서브화면은 백맵 목적지로', () => {
    // 설정은 마이페이지의 서브화면 (#1088) — 디자인·알림 화면은 설정으로, 계정·콘텐츠성 화면은 마이페이지로.
    expect(backTargetFor('settings', 'routineManage', false)).toBe('myPage');
    // 달력 탭(#1138)의 백은 나의 방, 달력에서 연 루틴 추가는 달력으로.
    expect(backTargetFor('calendar', 'routineManage', false)).toBe('myRoom');
    expect(backTargetFor('addRoutine', 'calendar', false)).toBe('calendar');
    expect(backTargetFor('theme', 'routineManage', false)).toBe('settings');
    expect(backTargetFor('help', 'routineManage', false)).toBe('myPage');
    expect(backTargetFor('profileEdit', 'routineManage', false)).toBe('myPage');
    expect(backTargetFor('calendarImport', 'routineManage', false)).toBe('myPage'); // #1097
    expect(backTargetFor('friendRoom', 'routineManage', false)).toBe('house');
    expect(backTargetFor('decor', 'routineManage', false)).toBe('myRoom');
  });

  it('addRoutine은 연 곳으로 돌아간다', () => {
    expect(backTargetFor('addRoutine', 'myRoom', false)).toBe('myRoom');
    expect(backTargetFor('addRoutine', 'routineManage', false)).toBe('routineManage');
  });

  it('집 없는 유저의 탐색은 빈 집 화면 대신 나의 방으로 (#571)', () => {
    // 구성원 관리 — 셸 화면 승격(#753) 후 백은 집 탭으로.
    expect(backTargetFor('houseMembers', 'routineManage', false)).toBe('house');
    expect(backTargetFor('houseSearch', 'routineManage', true)).toBe('myRoom');
    expect(backTargetFor('houseSearch', 'routineManage', false)).toBe('house');
  });

  it('루트(나의 방)는 목적지 없음', () => {
    expect(backTargetFor('myRoom', 'routineManage', false)).toBeNull();
  });

  it('전폭 스와이프 백 제외 화면 — 가로 제스처를 쓰는 곳만 (#1135)', () => {
    expect([...FULL_SWIPE_BACK_EXCLUDED].sort()).toEqual(
      ['addRoutine', 'decor', 'friendRoom', 'gacha'].sort(),
    );
    // 설정·도움말 같은 세로 화면은 어디서나 우향 스와이프로 뒤로.
    expect(FULL_SWIPE_BACK_EXCLUDED.has('settings')).toBe(false);
  });
});
