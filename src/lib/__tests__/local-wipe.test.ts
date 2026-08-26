import AsyncStorage from '@react-native-async-storage/async-storage';

import { wipeLocalAppData } from '@/lib/local-wipe';

describe('wipeLocalAppData (#922)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('rougether.* 를 전부 지우고 남의 키는 건드리지 않는다', async () => {
    await AsyncStorage.multiSet([
      ['rougether.onboarding.v1', 'done'],
      ['rougether.onboarding-missions.v1', '{}'],
      ['rougether.routine-order', '[]'],
      ['rougether.widget.room-image.v1', 'data:image/png;base64,AAAA'],
      ['rougether.theme', 'cozy'],
      ['rougether.device-settings', '{}'],
      ['rougether.last-login-provider.v1', 'kakao'],
      ['rougether.weeklyReport.lastRead.v1', '2026-08-01'],
      ['rougether.auth.accessToken', 'jwt'],
      // 다른 라이브러리의 키는 우리 것이 아니다.
      ['expo.notifications.token', 'keep-me'],
    ]);

    await wipeLocalAppData();

    const left = await AsyncStorage.getAllKeys();
    expect(left).toEqual(['expo.notifications.token']);
  });

  it('동적으로 만들어지는 방 배치 키도 지운다 — 고정 목록으로는 못 잡는다', async () => {
    // room-layout-store.ts: `rougether.roomLayout.v1.${userId}.${houseId}`
    await AsyncStorage.multiSet([
      ['rougether.roomLayout.v1.4.11', '[]'],
      ['rougether.roomLayout.v1.4.12', '[]'],
      ['rougether.roomLayout.v1.anon.7', '[]'],
    ]);

    await wipeLocalAppData();

    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('저장소가 터져도 예외를 밖으로 던지지 않는다 — 탈퇴를 되돌릴 수 없다', async () => {
    const boom = jest
      .spyOn(AsyncStorage, 'getAllKeys')
      .mockRejectedValueOnce(new Error('storage down'));

    await expect(wipeLocalAppData()).resolves.toEqual([]);
    boom.mockRestore();
  });
});
