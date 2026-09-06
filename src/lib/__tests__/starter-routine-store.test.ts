import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadStarterRoutineProgress,
  saveStarterRoutineProgress,
} from '@/lib/starter-routine-store';

describe('첫 루틴 진행 저장', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });
  it('계정별로 분리하고 식별자가 없으면 공용 상태를 저장하지 않는다', async () => {
    const progress = { status: 'pending' as const, goals: [{ id: 'reading', label: '독서' }] };
    await saveStarterRoutineProgress(1, progress);
    await saveStarterRoutineProgress(undefined, progress);
    expect(await loadStarterRoutineProgress(1)).toEqual(progress);
    expect(await loadStarterRoutineProgress(2)).toBeNull();
    expect(await loadStarterRoutineProgress(undefined)).toBeNull();
  });
  it('손상된 데이터는 화면을 깨지 않고 무시한다', async () => {
    await AsyncStorage.setItem(
      'rougether.starter-routine.v1.1',
      JSON.stringify({ status: 'pending', goals: [null] }),
    );
    expect(await loadStarterRoutineProgress(1)).toBeNull();
  });
});
