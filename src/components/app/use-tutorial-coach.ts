import type { Screen } from '@/components/app/navigation';
import type { CoachStep } from '@/components/ui/coach-mark';
import type { OnboardingMissionStepId } from '@/hooks/use-onboarding-missions';
import { i18n } from '@/i18n';

/**
 * 튜토리얼 코치마크 매핑 (#1324) — (현재 미션, 현재 화면) → 스포트라이트할 대상과 문구.
 *
 * 오버레이는 완전 잠금이라 진행 버튼이 없다. "다음"은 사용자가 대상을 눌러 화면이나
 * 미션 상태가 바뀌면 이 함수가 다시 평가돼 자연히 넘어간다. 미션의 흐름 밖 화면에
 * 있으면 하단 탭의 해당 탭을 짚어 돌아가게 한다(잠긴 채 길을 잃지 않게).
 */
export type TutorialContext = {
  /** 집이 없으면 집 탭이 집 탐색으로 가므로 초대 미션은 탐색에서 집부터 만들어야 한다. */
  noHouses?: boolean;
};

/** 문구는 호출 시점에 읽는다 (#893) — 셸이 렌더마다 부르므로 언어 변경이 곧 반영된다. */
function copy(key: string): Pick<CoachStep, 'title' | 'body'> {
  return {
    title: i18n.t(`member.tutorial.coach.${key}.title`),
    body: i18n.t(`member.tutorial.coach.${key}.body`),
  };
}

const backToRoom = (): CoachStep => ({ target: 'nav-myRoom', ...copy('backToRoom') });

export function tutorialCoachStep(
  step: OnboardingMissionStepId | undefined,
  screen: Screen,
  ctx: TutorialContext = {},
): CoachStep | null {
  if (!step) return null;
  switch (step) {
    case 'complete-routine':
      return screen === 'myRoom'
        ? {
            target: 'room-routine-check',
            ...copy('completeRoutine'),
          }
        : backToRoom();
    case 'first-draw':
      if (screen === 'gacha') {
        return {
          target: 'gacha-draw',
          ...copy('draw'),
        };
      }
      return screen === 'myRoom'
        ? {
            target: 'room-gacha',
            ...copy('goToGacha'),
          }
        : backToRoom();
    case 'place-furniture':
      if (screen === 'decor') {
        return {
          targets: ['decor-grid', 'decor-apply'],
          ...copy('placeFurniture'),
        };
      }
      return screen === 'myRoom'
        ? {
            target: 'room-decor',
            ...copy('goToDecor'),
          }
        : backToRoom();
    case 'invite-house':
      if (screen === 'houseMembers') {
        return {
          target: 'house-invite-share',
          ...copy('shareInvite'),
        };
      }
      if (screen === 'house') {
        return {
          target: 'house-manage',
          ...copy('houseManage'),
        };
      }
      if (screen === 'houseSearch' && ctx.noHouses) {
        // 집이 없으면 코치마크 없이 자유롭게 — 집을 만들거나 들어가면 다시 짚는다.
        return null;
      }
      return {
        target: 'nav-house',
        ...copy('goToHouse'),
      };
  }
}
