import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo } from 'react';

import type { Screen } from '@/components/app/navigation';
import { MissionSheet } from '@/components/screens/sheets/mission-sheet';
import { MissionBanner } from '@/components/ui/mission-banner';
import {
  type OnboardingMissionStepId,
  useOnboardingMissions,
} from '@/hooks/use-onboarding-missions';
import { useStableCallback } from '@/hooks/use-stable-value';
import { calendarToday } from '@/utils/calendar-progress';

/** 각 미션의 진입 화면 (#571) — 배너 탭·완료 시트 '하러 가기'의 목적지. */
const MISSION_TARGET_SCREEN: Record<OnboardingMissionStepId, Screen> = {
  'complete-routine': 'myRoom',
  'first-draw': 'gacha',
  'place-furniture': 'decor',
  'invite-house': 'houseMembers',
};

/** 미션 진행 배너를 얹는 화면들 — 미션과 관련된 탭·서브화면 상단. */
const MISSION_BANNER_SCREENS: ReadonlySet<Screen> = new Set<Screen>([
  'myRoom',
  'addRoutine',
  'decor',
  'gacha',
  'house',
  'houseSearch',
  // 초대 미션의 목적지 (#1324) — 링크 공유 버튼이 여기 있다.
  'houseMembers',
]);

/**
 * 온보딩 미션 체인 배선 (#571, 장부 5번) — 진행 상태·진입 화면 이동·'오늘 이미 완료'
 * 자동 진행과 배너·완료 시트 JSX를 셸에서 옮겨 왔다. 셸은 `banner`·`sheet`를 원래
 * 자리(쌓임 순서)에 그대로 두고, 코치마크는 집 유무를 읽어야 해 셸에 남는다.
 */
export function useMissionSurface({
  startMissions,
  missionSkipEnabled,
  screen,
  setScreen,
  completions,
}: {
  /** 온보딩 완주 직후 시작 — 완료/스킵 플래그가 있으면 시작하지 않는다. */
  startMissions: boolean;
  missionSkipEnabled: boolean;
  screen: Screen;
  setScreen: Dispatch<SetStateAction<Screen>>;
  /** 루틴별 완료 날짜 — '루틴 완료' 미션을 오늘 이미 끝냈는지 본다. */
  completions: Record<string, string[]>;
}) {
  const missions = useOnboardingMissions(startMissions);
  const completeMission = missions.complete;

  // 미션이 '루틴 완료'인데 오늘 이미 완료한 루틴이 있으면(다시 보기·늦은 시작) 바로 넘긴다 —
  // 대상(미완료 행)이 없어 코치마크가 짚을 곳이 없다.
  const completedTodayAlready = useMemo(() => {
    const today = calendarToday();
    return Object.values(completions).some((dates) => dates.includes(today));
  }, [completions]);
  useEffect(() => {
    if (missions.step?.id === 'complete-routine' && completedTodayAlready) {
      completeMission('complete-routine');
    }
  }, [missions.step?.id, completedTodayAlready, completeMission]);

  /** 미션 배너 탭·완료 시트 '하러 가기' — 해당 미션의 진입 화면으로 (#571). */
  const openMissionScreen = useCallback(
    (id: OnboardingMissionStepId) => {
      setScreen(MISSION_TARGET_SCREEN[id]);
    },
    [setScreen],
  );
  // 셸 자식에 넘기는 콜백은 참조를 고정한다(성능 장부 R9).
  const goToNextMission = useStableCallback(() => {
    const id = missions.step?.id;
    missions.dismissCompleted();
    if (id) openMissionScreen(id);
  });

  /** 온보딩 미션 진행 배너 (#571) — 관련 화면 상단에만 얹는다. */
  const banner =
    missions.step && MISSION_BANNER_SCREENS.has(screen) ? (
      <MissionBanner
        stepIndex={missions.stepIndex}
        totalSteps={missions.totalSteps}
        label={missions.step.label}
        onPress={() => {
          const id = missions.step?.id;
          if (id) openMissionScreen(id);
        }}
        onSkip={missions.skip}
        canSkip={missionSkipEnabled}
      />
    ) : null;

  /** 미션 완료 전환 시트 (#571) — 다음 미션 안내 / 마지막 축하. */
  const sheet = (
    <MissionSheet
      visible={missions.completedIndex != null}
      completedStep={(missions.completedIndex ?? 0) + 1}
      totalSteps={missions.totalSteps}
      nextLabel={missions.step?.label ?? null}
      nextHint={missions.step?.hint ?? null}
      onGo={goToNextMission}
      onClose={missions.dismissCompleted}
    />
  );

  return { missions, completeMission, banner, sheet };
}
