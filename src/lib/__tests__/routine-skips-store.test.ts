import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadRoutineSkips, saveRoutineSkips } from '@/lib/routine-skips-store';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('routine-skips-store (#189)', () => {
  it('저장한 건너뜀을 계정별 키로 돌려주고, 지난 날짜는 읽을 때 걷어낸다', async () => {
    await saveRoutineSkips(7, {
      r5: ['2026-09-10', '2026-09-13', '2026-09-20'],
      'r-6': ['2026-09-01'],
    });
    expect(await loadRoutineSkips(7, '2026-09-13')).toEqual({
      r5: ['2026-09-13', '2026-09-20'],
    });
    // 다른 계정은 비어 있다 — 기기 단위 키가 아니다.
    expect(await loadRoutineSkips(8, '2026-09-13')).toEqual({});
    expect(await AsyncStorage.getItem('rougether.routine-skips.v1.7')).toContain('r5');
  });

  it('userId가 없거나 저장값이 깨졌으면 빈 객체', async () => {
    expect(await loadRoutineSkips(undefined, '2026-09-13')).toEqual({});
    await AsyncStorage.setItem('rougether.routine-skips.v1.7', '{not json');
    expect(await loadRoutineSkips(7, '2026-09-13')).toEqual({});
    await AsyncStorage.setItem('rougether.routine-skips.v1.7', JSON.stringify({ 'r-1': 'x' }));
    expect(await loadRoutineSkips(7, '2026-09-13')).toEqual({});
  });
});
