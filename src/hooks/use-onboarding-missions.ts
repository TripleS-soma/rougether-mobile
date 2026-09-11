import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getSessionUserId } from '@/api';
import { track } from '@/lib/analytics';

/** 완료/스킵 플래그만 영속 (#571) — 중간 진행은 저장하지 않는다(중도 이탈 시
 * 다음 시작에 처음부터). */
const LEGACY_STORE_KEY = 'rougether.onboarding-missions.v1';
/**
 * 계정별 플래그 (2026-09-11) — 기기 단위 키였을 때는 같은 기기의 앞 계정(또는 안드로이드
 * 자동 백업 복원분)이 끝낸 미션이 새 계정의 첫 가입 미션을 막았다. 자동 시작은 첫 온보딩·
 * 다시 보기 직후에만 일어나므로 옛 키는 읽지 않는다. 계정을 모르면 옛 키를 쓴다.
 */
function storeKey(): string {
  const userId = getSessionUserId();
  return userId == null ? LEGACY_STORE_KEY : `${LEGACY_STORE_KEY}.${userId}`;
}

export type OnboardingMissionStepId = 'first-draw' | 'place-furniture' | 'invite-house';

export type OnboardingMissionStep = {
  id: OnboardingMissionStepId;
  label: string;
  /** 어디서·어떻게 하는지 한 줄 — 완료 시트의 다음 미션 안내에 붙는다. */
  hint: string;
};

/** 온보딩 미션 체인 4단계 (#571) — 순서대로만 진행된다. */
// 첫 루틴 등록 단계는 뺐다(2026-09-08) — 온보딩 직후의 관심사 추천 루틴 게이트(#1149)가
// 그 역할을 하므로 중복이었다. 체인은 뽑기 → 방 꾸미기 → 친구 초대 3단계.
export const ONBOARDING_MISSION_STEPS: OnboardingMissionStep[] = [
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
    hint: '집 관리에서 초대코드를 복사해 친구에게 보내요',
  },
];

/** '튜토리얼 다시 보기' 재시작용 — 플래그를 지우면 온보딩 완주 직후의
 * 자동 시작 경로가 다시 열린다. 이 계정 플래그만 지운다 — 옛 기기 플래그는 다른 계정
 * 것일 수 있다(#1299 리뷰). */
export async function resetOnboardingMissions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(storeKey());
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
 * 때만 다음으로 진행된다.
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
    void AsyncStorage.getItem(storeKey())
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
      void AsyncStorage.setItem(storeKey(), 'completed').catch(() => {});
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
    void AsyncStorage.setItem(storeKey(), 'skipped').catch(() => {});
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
