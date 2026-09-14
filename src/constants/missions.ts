import type { PictogramName } from '@/components/ui/pictograms';

/**
 * 미션 유형별 표시 규칙 — **단위·상한·라벨의 단일 출처** (#872, #887).
 * 라벨·단위는 i18n 키다 (#893) — 화면은 `tr(key)`, 어댑터는 호출 시점에 `i18n.t(key)`.
 *
 * 예전엔 단위가 두 군데에 흩어져 있었다: 어댑터가 진행 라벨(`일일 구성원
 * 달성률`)을, 생성 모달이 입력 단위(`%`)를 따로 들고 있었다. 그래서 만들 때는
 * "1~100%"라고 물어놓고 **목록에서는 `25/100`으로만 보여줬다** — 같은 숫자가
 * 화면마다 뜻이 달라 보였다.
 *
 * - `DAILY_MEMBER_RATE`: 오늘 기여한 멤버 **비율 %** → 1~100. 넘기면 서버가
 *   400 `HOUSE_MISSION_TARGET_INVALID`을 준다.
 * - `WEEKLY_MEMBER_COUNT`: 기여 **누적 합** → 1~1000.
 * - `STREAK_DAYS`: 서버에 타입은 있으나 MVP에서 생성 불가 —
 *   `NewHouseMission['missionType']`에 없다. 목록 표시용으로만 남긴다.
 */
export const MISSION_TYPE_RULES = {
  DAILY_MEMBER_RATE: {
    icon: 'sun',
    /** 목록 카드의 진행바 아래 설명. */
    labelKey: 'house.missionTypes.dailyMemberRate.label',
    /** 생성 모달의 유형 선택 칩 — 좁아서 짧게. */
    shortLabelKey: 'house.missionTypes.dailyMemberRate.shortLabel',
    unitKey: 'house.missionTypes.dailyMemberRate.unit',
    max: 100,
  },
  WEEKLY_MEMBER_COUNT: {
    icon: 'calendar',
    labelKey: 'house.missionTypes.weeklyMemberCount.label',
    shortLabelKey: 'house.missionTypes.weeklyMemberCount.shortLabel',
    unitKey: 'house.missionTypes.weeklyMemberCount.unit',
    max: 1000,
  },
  STREAK_DAYS: {
    icon: 'sparkle',
    labelKey: 'house.missionTypes.streakDays.label',
    shortLabelKey: 'house.missionTypes.streakDays.shortLabel',
    unitKey: 'house.missionTypes.streakDays.unit',
    max: 365,
  },
} as const satisfies Record<
  string,
  { icon: PictogramName; labelKey: string; shortLabelKey: string; unitKey: string; max: number }
>;

/** 서버가 모르는 유형을 보내와도 카드가 비지 않게 하는 폴백. */
export const MISSION_TYPE_FALLBACK = {
  icon: 'target',
  labelKey: 'house.missionTypes.fallback.label',
  shortLabelKey: 'house.missionTypes.fallback.shortLabel',
  /** 단위 없음 — 빈 문자열이라 i18n 키가 아니다. 호출측이 falsy면 단위를 생략한다. */
  unitKey: '',
  max: 1000,
} as const satisfies {
  icon: PictogramName;
  labelKey: string;
  shortLabelKey: string;
  unitKey: string;
  max: number;
};
