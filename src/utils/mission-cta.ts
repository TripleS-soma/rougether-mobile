/**
 * 미션 상태 union + CTA 결정 (#559) — status 리터럴 산개와 6+ 삼항 체인을
 * 한 곳의 순수 함수로 모은다. 렌더는 kind → 라벨/버튼 매핑만 한다.
 */

export type MissionStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export type MissionCtaState =
  | { kind: 'completed' } // '완료' 라벨
  | { kind: 'expired' } // '기간 만료' 라벨
  | { kind: 'claim' } // '보상 받기' 버튼
  | { kind: 'contributed' } // '기여함' 라벨
  | { kind: 'linked' } // '루틴 연동됨' 라벨
  | { kind: 'addRoutine' } // '＋ 내 루틴에' 버튼
  | { kind: 'none' };

export type MissionCtaInput = {
  status: MissionStatus;
  /** 목표 달성(서버 achieved) — 보상 수령 가능의 전제. */
  achieved?: boolean;
  /** 오늘 기여 완료(연동 루틴의 오늘 완료 여부로도 파생). */
  contributed: boolean;
  /** 이 미션이 내 루틴으로 연동돼 있는지. */
  linked: boolean;
  /** 보상 수령 배선 존재(houseId + onClaimMission). */
  canClaim: boolean;
  /** 루틴 추가 배선 존재(houseId + onAddMissionRoutine). */
  canAddRoutine: boolean;
};

/**
 * ACTIVE 안에서의 우선순위: 보상 수령 > 기여함 > 연동됨 > 루틴 추가.
 * switch는 exhaustive — 새 status가 생기면 여기서 컴파일이 깨진다.
 */
export function missionCtaState(input: MissionCtaInput): MissionCtaState {
  switch (input.status) {
    case 'COMPLETED':
      return { kind: 'completed' };
    case 'EXPIRED':
      return { kind: 'expired' };
    case 'ACTIVE':
      if (input.achieved && input.canClaim) return { kind: 'claim' };
      if (input.contributed) return { kind: 'contributed' };
      if (input.linked) return { kind: 'linked' };
      if (input.canAddRoutine) return { kind: 'addRoutine' };
      return { kind: 'none' };
  }
}
