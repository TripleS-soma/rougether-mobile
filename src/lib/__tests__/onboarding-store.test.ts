import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  LEGACY_ONBOARDING_KEY,
  loadOnboarding,
  resetOnboarding,
  saveOnboarding,
} from '@/lib/onboarding-store';

describe('onboarding-store 계정별 기록 (#1298)', () => {
  /**
   * #1299 리뷰 1 — 다시 보기 초기화가 옛 기기 기록까지 지우면, 그 기록이 유일한 완료 신호인
   * 다른 계정(캐릭터 저장 409로 서버 completed=false)이 이 기기에서 온보딩을 다시 보게 된다.
   */
  it('다시 보기 초기화는 이 계정 기록만 지우고 옛 기기 기록은 남긴다', async () => {
    await AsyncStorage.setItem(
      LEGACY_ONBOARDING_KEY,
      JSON.stringify({ characterId: 'bear', goals: ['9'] }),
    );
    await saveOnboarding({ characterId: 'cat', goals: ['1'] }, 72);

    await resetOnboarding(72);

    expect(await AsyncStorage.getItem(`${LEGACY_ONBOARDING_KEY}.72`)).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_ONBOARDING_KEY)).not.toBeNull();
  });

  it('계정을 모르면 옛 기기 키에 쓰고 읽고 지운다', async () => {
    await saveOnboarding({ characterId: 'cat', goals: [] });
    expect(await loadOnboarding()).toEqual({
      data: { characterId: 'cat', goals: [] },
      legacy: false,
    });

    await resetOnboarding();

    expect(await AsyncStorage.getItem(LEGACY_ONBOARDING_KEY)).toBeNull();
  });
});
