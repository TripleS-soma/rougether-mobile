import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { track } from '@/lib/analytics';

/** 완료/스킵 플래그만 영속 (#571) — 중간 진행은 저장하지 않는다(중도 이탈 시
 * 다음 시작에 처음부터). */
const STORE_KEY = 'rougether.onboarding-missions.v1';

export type OnboardingMissionStepId =
  'register-routine' | 'first-draw' | 'place-furniture' | 'invite-house';

export type OnboardingMissionStep = {
  id: OnboardingMissionStepId;
  label: string;
  /** 어디서·어떻게 하는지 한 줄 — 완료 시트의 다음 미션 안내에 붙는다. */
  hint: string;
};

/** 온보딩 미션 체인 4단계 (#571) — 순서대로만 진행된다. */
export const ONBOARDING_MISSION_STEPS: OnboardingMissionStep[] = [
  {
    id: 'register-routine',
    label: '첫 루틴 등록하기',
    hint: '추천 루틴에서 골라 담으면 바로 끝나요',
  },
  { id: 'first-draw', label: '뽑기 1회 해보기', hint: '뽑기에서 코인으로 한 번 뽑아요' },
  {
    id: 'place-furniture',
    label: '방 꾸미기 저장하기',
    hint: '방 꾸미기에서 가구를 놓고 저장해요',
  },
  // 4단계는 '다른 집 둘러보기'였다 (#571). 서버가 온보딩에서 기본 집을
  // 자동 생성하면서(서버 #288) 전제가 바뀌었다 — 이제 내 집이 이미 있고,
  // 혼자인 4인집을 채우는 게 다음 행동이다 (#841).
  {
    id: 'invite-house',
    label: '집에 친구 초대하기',
    hint: '집 구성원 목록에서 초대코드를 복사해 친구에게 보내요',
  },
];

/** '튜토리얼 다시 보기' 재시작용 — 플래그를 지우면 온보딩 완주 직후의
 * 자동 시작 경로가 다시 열린다. */
export async function resetOnboardingMissions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORE_KEY);
  } catch {
    // ignore — 다음 시작 판정만 영향받는 베스트 에포트 플래그.
  }
}

type MissionState = {
  active: boolean;
  stepIndex: number;
  /** 방금 완료한 단계 index — 완료 전환 시트 표시용. null이면 시트 없음. */
  completedIndex: number | null;
};

const IDLE: MissionState = { active: false, stepIndex: 0, completedIndex: null };

/**
 * 온보딩 미션 체인 상태 (#571) — 코치마크 튜토리얼을 대체한다.
 * `autoStart`(온보딩 완주 직후)일 때 완료/스킵 플래그가 없으면 1단계부터
 * 시작하고, 셸의 액션 지점이 `complete(stepId)`를 쏘면 현재 단계와 일치할
 * 때만 다음으로 진행된다. PostHog 퍼널 이벤트는 여기서만 발화한다.
 */
export function useOnboardingMissions(autoStart: boolean) {
  const [state, setState] = useState<MissionState>(IDLE);
  // complete/skip은 memo 화면으로 흘러갈 수 있어 참조를 고정([] deps)하고,
  // 최신 상태는 ref로 본다.
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!autoStart) return;
    let mounted = true;
    void AsyncStorage.getItem(STORE_KEY)
      .then((flag) => {
        if (!mounted || flag != null || stateRef.current.active) return;
        setState({ active: true, stepIndex: 0, completedIndex: null });
        track('onboarding_mission_start', { step: ONBOARDING_MISSION_STEPS[0].id });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [autoStart]);

  /** 셸 액션 지점에서 호출 — 현재 단계가 아니면 무시(순서 강제). */
  const complete = useCallback((id: OnboardingMissionStepId) => {
    const s = stateRef.current;
    if (!s.active || ONBOARDING_MISSION_STEPS[s.stepIndex]?.id !== id) return;
    track('onboarding_mission_complete', { step: id });
    const next = s.stepIndex + 1;
    if (next >= ONBOARDING_MISSION_STEPS.length) {
      // 마지막 미션 — 배너는 소멸하고 축하 시트만 남는다.
      void AsyncStorage.setItem(STORE_KEY, 'completed').catch(() => {});
      setState({ active: false, stepIndex: s.stepIndex, completedIndex: s.stepIndex });
      return;
    }
    track('onboarding_mission_start', { step: ONBOARDING_MISSION_STEPS[next].id });
    setState({ active: true, stepIndex: next, completedIndex: s.stepIndex });
  }, []);

  /** 전체 건너뛰기 — 확인 다이얼로그는 배너 몫, 여기는 확정 시점. */
  const skip = useCallback(() => {
    const s = stateRef.current;
    if (!s.active) return;
    track('onboarding_mission_skip', { step: ONBOARDING_MISSION_STEPS[s.stepIndex].id });
    void AsyncStorage.setItem(STORE_KEY, 'skipped').catch(() => {});
    setState({ active: false, stepIndex: s.stepIndex, completedIndex: null });
  }, []);

  /** 완료 전환 시트 닫기. */
  const dismissCompleted = useCallback(() => {
    setState((prev) => (prev.completedIndex == null ? prev : { ...prev, completedIndex: null }));
  }, []);

  return {
    /** 배너 표시 여부 — 체인이 진행 중일 때만. */
    active: state.active,
    stepIndex: state.stepIndex,
    /** 현재 진행 중인 단계 — 비활성이면 null. */
    step: state.active ? ONBOARDING_MISSION_STEPS[state.stepIndex] : null,
    /** 방금 완료한 단계 index — 완료 전환 시트가 이 값으로 열린다. */
    completedIndex: state.completedIndex,
    totalSteps: ONBOARDING_MISSION_STEPS.length,
    complete,
    skip,
    dismissCompleted,
  };
}
