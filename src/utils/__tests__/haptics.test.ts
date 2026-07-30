import * as Haptics from 'expo-haptics';

import {
  hapticImpact,
  hapticSelection,
  hapticSuccess,
  isHapticsEnabled,
  setHapticsEnabled,
} from '@/utils/haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

const mocked = Haptics as jest.Mocked<typeof Haptics>;

describe('haptics 전역 게이트 (#586)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHapticsEnabled(true);
  });
  afterEach(() => {
    setHapticsEnabled(true);
  });

  it('기본은 on — 설정 기본값(햅틱 진동 on)과 같다', () => {
    expect(isHapticsEnabled()).toBe(true);
    hapticSelection();
    expect(mocked.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('게이트 off면 세 헬퍼 모두 무음이다', () => {
    setHapticsEnabled(false);
    hapticSelection();
    hapticImpact();
    hapticSuccess();
    expect(mocked.selectionAsync).not.toHaveBeenCalled();
    expect(mocked.impactAsync).not.toHaveBeenCalled();
    expect(mocked.notificationAsync).not.toHaveBeenCalled();
  });

  it('다시 켜면 재개된다', () => {
    setHapticsEnabled(false);
    hapticSuccess();
    setHapticsEnabled(true);
    hapticSuccess();
    expect(mocked.notificationAsync).toHaveBeenCalledTimes(1);
  });
});
