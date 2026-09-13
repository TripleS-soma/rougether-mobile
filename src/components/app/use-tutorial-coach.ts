import type { Screen } from '@/components/app/navigation';
import type { CoachStep } from '@/components/ui/coach-mark';
import type { OnboardingMissionStepId } from '@/hooks/use-onboarding-missions';

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

const BACK_TO_ROOM: CoachStep = {
  target: 'nav-myRoom',
  title: '나의 방으로 돌아가요',
  body: '아래 방 탭을 눌러 미션을 이어가요.',
};

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
            title: '오늘 루틴을 완료해 봐요',
            body: '체크를 누르면 오늘 몫이 완료되고 코인을 받아요.',
          }
        : BACK_TO_ROOM;
    case 'first-draw':
      if (screen === 'gacha') {
        return {
          target: 'gacha-draw',
          title: '한 번 뽑아 볼까요?',
          body: '1회 뽑기를 눌러 방을 꾸밀 가구를 얻어요.',
        };
      }
      return screen === 'myRoom'
        ? {
            target: 'room-gacha',
            title: '뽑기로 가구를 얻어요',
            body: '오른쪽의 선물 버튼을 눌러 뽑기로 가요.',
          }
        : BACK_TO_ROOM;
    case 'place-furniture':
      if (screen === 'decor') {
        return {
          targets: ['decor-grid', 'decor-apply'],
          title: '가구를 놓고 저장해요',
          body: '아래 목록에서 가구를 골라 방에 놓은 뒤 적용하기를 눌러요.',
        };
      }
      return screen === 'myRoom'
        ? {
            target: 'room-decor',
            title: '방을 꾸며 볼까요?',
            body: '연필 버튼을 눌러 꾸미기로 가요.',
          }
        : BACK_TO_ROOM;
    case 'invite-house':
      if (screen === 'houseMembers') {
        return {
          target: 'house-invite-share',
          title: '친구에게 초대 링크를 보내요',
          body: '링크 공유를 누르면 친구가 바로 집에 들어올 수 있어요.',
        };
      }
      if (screen === 'house') {
        return {
          target: 'house-manage',
          title: '집 관리로 들어가요',
          body: '집 관리에서 친구를 초대할 수 있어요.',
        };
      }
      if (screen === 'houseSearch' && ctx.noHouses) {
        // 집이 없으면 코치마크 없이 자유롭게 — 집을 만들거나 들어가면 다시 짚는다.
        return null;
      }
      return {
        target: 'nav-house',
        title: '집으로 가요',
        body: '아래 집 탭을 눌러 친구를 초대해요.',
      };
  }
}
