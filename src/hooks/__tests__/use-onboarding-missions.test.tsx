import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { track } from '@/lib/analytics';
import {
  ONBOARDING_MISSION_STEPS,
  resetOnboardingMissions,
  useOnboardingMissions,
} from '@/hooks/use-onboarding-missions';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const KEY = 'rougether.onboarding-missions.v1';

describe('useOnboardingMissions (#571)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (track as jest.Mock).mockClear();
  });

  it('autoStart에 플래그가 없으면 1단계부터 시작한다', async () => {
    const { result } = await renderHook(() => useOnboardingMissions(true));
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.step?.id).toBe('register-routine');
    expect(track).toHaveBeenCalledWith('onboarding_mission_start', { step: 'register-routine' });
  });

  it('autoStart가 아니면 시작하지 않는다', async () => {
    const { result } = await renderHook(() => useOnboardingMissions(false));
    await act(async () => {});
    expect(result.current.active).toBe(false);
    expect(result.current.step).toBeNull();
  });

  it('완료/스킵 플래그가 있으면 autoStart여도 시작하지 않는다', async () => {
    await AsyncStorage.setItem(KEY, 'completed');
    const { result } = await renderHook(() => useOnboardingMissions(true));
    await act(async () => {});
    expect(result.current.active).toBe(false);
  });

  it('현재 단계 완료만 진행되고, 순서가 다른 완료는 무시된다', async () => {
    const { result } = await renderHook(() => useOnboardingMissions(true));
    await waitFor(() => expect(result.current.active).toBe(true));

    // 2단계(뽑기)를 먼저 쏘면 무시 — 순서 강제.
    await act(async () => result.current.complete('first-draw'));
    expect(result.current.stepIndex).toBe(0);
    expect(result.current.completedIndex).toBeNull();

    await act(async () => result.current.complete('register-routine'));
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.step?.id).toBe('first-draw');
    // 완료 전환 시트용 index + 퍼널 이벤트.
    expect(result.current.completedIndex).toBe(0);
    expect(track).toHaveBeenCalledWith('onboarding_mission_complete', {
      step: 'register-routine',
    });
    expect(track).toHaveBeenCalledWith('onboarding_mission_start', { step: 'first-draw' });

    await act(async () => result.current.dismissCompleted());
    expect(result.current.completedIndex).toBeNull();
  });

  it('마지막 미션 완료 시 배너가 소멸하고 완료 플래그가 영속된다', async () => {
    const { result } = await renderHook(() => useOnboardingMissions(true));
    await waitFor(() => expect(result.current.active).toBe(true));

    for (const step of ONBOARDING_MISSION_STEPS) {
      await act(async () => result.current.complete(step.id));
    }
    expect(result.current.active).toBe(false);
    expect(result.current.step).toBeNull();
    // 마지막 완료 시트(축하)용 index는 남는다.
    expect(result.current.completedIndex).toBe(3);
    await waitFor(async () => expect(await AsyncStorage.getItem(KEY)).toBe('completed'));
  });

  it('건너뛰기는 즉시 종료하고 스킵 플래그를 영속한다', async () => {
    const { result } = await renderHook(() => useOnboardingMissions(true));
    await waitFor(() => expect(result.current.active).toBe(true));

    await act(async () => result.current.skip());
    expect(result.current.active).toBe(false);
    expect(track).toHaveBeenCalledWith('onboarding_mission_skip', { step: 'register-routine' });
    await waitFor(async () => expect(await AsyncStorage.getItem(KEY)).toBe('skipped'));
  });

  it('resetOnboardingMissions가 플래그를 지워 재시작 경로를 연다', async () => {
    await AsyncStorage.setItem(KEY, 'skipped');
    await resetOnboardingMissions();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();

    const { result } = await renderHook(() => useOnboardingMissions(true));
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(result.current.stepIndex).toBe(0);
  });
});
