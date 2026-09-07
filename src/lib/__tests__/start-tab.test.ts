import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_START_TAB, readStartTab, START_TAB_KEY, writeStartTab } from '@/lib/start-tab';

// 시작 화면 설정 (#1139) — 저장값이 없거나 깨졌으면 나의 방.
describe('start-tab', () => {
  beforeEach(() => AsyncStorage.clear());

  it('저장값이 없으면 기본(나의 방)', async () => {
    expect(await readStartTab()).toBe(DEFAULT_START_TAB);
  });

  it('쓴 값을 그대로 읽고, 모르는 값은 기본으로 떨어진다', async () => {
    await writeStartTab('myPage');
    expect(await readStartTab()).toBe('myPage');
    await AsyncStorage.setItem(START_TAB_KEY, 'settings'); // 옛 탭 이름
    expect(await readStartTab()).toBe(DEFAULT_START_TAB);
  });
});
