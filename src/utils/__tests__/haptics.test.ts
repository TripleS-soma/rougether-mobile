import * as Haptics from 'expo-haptics';

import {
  DEFAULT_HAPTIC_STRENGTH,
  getHapticStrength,
  hapticImpact,
  hapticSelection,
  hapticSuccess,
  setHapticStrength,
} from '@/utils/haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

const mocked = Haptics as jest.Mocked<typeof Haptics>;

describe('haptics 전역 게이트 (#586 → 세기 단계 #974)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHapticStrength(DEFAULT_HAPTIC_STRENGTH);
  });
  afterEach(() => setHapticStrength(DEFAULT_HAPTIC_STRENGTH));

  it('기본은 보통 — 설정 기본값과 같다', () => {
    expect(getHapticStrength()).toBe('medium');
    hapticSelection();
    expect(mocked.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('끄기면 세 헬퍼 모두 무음이다', () => {
    setHapticStrength('off');
    hapticSelection();
    hapticImpact();
    hapticSuccess();
    expect(mocked.selectionAsync).not.toHaveBeenCalled();
    expect(mocked.impactAsync).not.toHaveBeenCalled();
    expect(mocked.notificationAsync).not.toHaveBeenCalled();
  });

  it('다시 켜면 재개된다', () => {
    setHapticStrength('off');
    hapticSuccess();
    setHapticStrength('medium');
    hapticSuccess();
    expect(mocked.notificationAsync).toHaveBeenCalledTimes(1);
  });

  describe('선택 틱은 세기를 따른다 — selectionAsync에 인자가 없어서', () => {
    it('약이면 Light 임팩트로 갈아끼운다', () => {
      setHapticStrength('light');
      hapticSelection();
      expect(mocked.selectionAsync).not.toHaveBeenCalled();
      expect(mocked.impactAsync).toHaveBeenCalledWith('light');
    });

    it('강이면 Medium 임팩트 — selection보다 확실히 세다', () => {
      setHapticStrength('heavy');
      hapticSelection();
      expect(mocked.impactAsync).toHaveBeenCalledWith('medium');
    });
  });

  describe('임팩트는 세기로 덮인다', () => {
    it('약·강은 호출부 style을 무시하고 단계값을 쓴다', () => {
      setHapticStrength('light');
      hapticImpact(Haptics.ImpactFeedbackStyle.Heavy);
      expect(mocked.impactAsync).toHaveBeenCalledWith('light');

      jest.clearAllMocks();
      setHapticStrength('heavy');
      hapticImpact(Haptics.ImpactFeedbackStyle.Light);
      expect(mocked.impactAsync).toHaveBeenCalledWith('heavy');
    });

    it('보통일 때만 호출부가 넘긴 style을 존중한다', () => {
      setHapticStrength('medium');
      hapticImpact(Haptics.ImpactFeedbackStyle.Heavy);
      expect(mocked.impactAsync).toHaveBeenCalledWith('heavy');
    });
  });

  it('완료 알림은 세기를 안 따른다 — 고유 리듬이 뜻을 만든다', () => {
    // 단일 임팩트로 바꾸면 '완료됐다'는 신호가 사라진다 (#974 합의).
    for (const s of ['light', 'medium', 'heavy'] as const) {
      jest.clearAllMocks();
      setHapticStrength(s);
      hapticSuccess();
      expect(mocked.notificationAsync).toHaveBeenCalledWith('success');
      expect(mocked.impactAsync).not.toHaveBeenCalled();
    }
  });
});
