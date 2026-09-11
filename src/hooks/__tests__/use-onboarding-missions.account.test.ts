import AsyncStorage from '@react-native-async-storage/async-storage';

import { resetOnboardingMissions } from '@/hooks/use-onboarding-missions';

jest.mock('@/api', () => ({ getSessionUserId: () => 72 }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const LEGACY = 'rougether.onboarding-missions.v1';

describe('resetOnboardingMissions — 계정별 플래그 (#1298)', () => {
  /** #1299 리뷰 3 — 옛 기기 플래그는 다른 계정 것일 수 있어 다시 보기 초기화가 지우지 않는다. */
  it('이 계정 미션 플래그만 지우고 옛 기기 플래그는 남긴다', async () => {
    await AsyncStorage.setItem(LEGACY, 'completed');
    await AsyncStorage.setItem(`${LEGACY}.72`, 'skipped');

    await resetOnboardingMissions();

    expect(await AsyncStorage.getItem(`${LEGACY}.72`)).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY)).toBe('completed');
  });
});
