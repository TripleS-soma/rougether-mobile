import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadRoomLayout, saveRoomLayout } from '@/lib/room-layout-store';

/**
 * 방 타일 배치의 기기 로컬 저장 (#278) — 계정·집별 키. 한 기기를 여러 계정이 쓰면 배치가
 * 섞이지 않아야 한다(기기 단위 키가 새 계정을 오염시킨 #1298과 같은 종류의 위험).
 */
const A = 11;
const B = 22;

afterEach(() => jest.restoreAllMocks());

describe('room-layout-store', () => {
  it('저장한 배치를 같은 계정·같은 집으로 다시 읽는다', async () => {
    await saveRoomLayout(5, [2, null, 1], A);
    await expect(loadRoomLayout(5, A)).resolves.toEqual([2, null, 1]);
  });

  it('없으면 null', async () => {
    await expect(loadRoomLayout(5, A)).resolves.toBeNull();
  });

  it('계정 A의 배치는 계정 B에게 보이지 않는다', async () => {
    await saveRoomLayout(5, [3, 2, 1], A);
    await expect(loadRoomLayout(5, B)).resolves.toBeNull();
    await saveRoomLayout(5, [1], B);
    await expect(loadRoomLayout(5, A)).resolves.toEqual([3, 2, 1]);
  });

  it('같은 계정이라도 집마다 따로 저장한다', async () => {
    await saveRoomLayout(5, [1], A);
    await expect(loadRoomLayout(6, A)).resolves.toBeNull();
  });

  it('userId가 없으면 anon 키로 — 로그인 계정과 섞이지 않는다', async () => {
    await saveRoomLayout(5, [9]);
    await expect(loadRoomLayout(5)).resolves.toEqual([9]);
    await expect(loadRoomLayout(5, A)).resolves.toBeNull();
    await expect(AsyncStorage.getItem('rougether.roomLayout.v1.anon.5')).resolves.toBe('[9]');
  });

  it('저장값이 깨졌으면 null로 폴백한다', async () => {
    await AsyncStorage.setItem(`rougether.roomLayout.v1.${A}.5`, '{not json');
    await expect(loadRoomLayout(5, A)).resolves.toBeNull();
  });

  it('저장소 읽기·쓰기 실패를 던지지 않는다', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    await expect(loadRoomLayout(5, A)).resolves.toBeNull();
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await expect(saveRoomLayout(5, [1], A)).resolves.toBeUndefined();
  });
});
