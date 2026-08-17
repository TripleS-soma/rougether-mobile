/** 연속 출석 이벤트 (#851, 서버 ad49433). */
import { apiGet, apiPost } from './client';

/**
 * 연속 출석 타입 — 스웨거가 응답하지 않아(2026-08-17) `gen:api-types`로 받지
 * 못했다. 스펙(`../rougether-spec/domains/attendance/api.md`)을 그대로 옮겨
 * 손으로 둔다. **다음 재생성 때 types.ts로 흡수하고 여기서 지울 것** —
 * CalendarMonthResponse가 같은 경로를 밟았다(#838 → #852에서 정리).
 */
export type AttendanceDailyReward = {
  day: number;
  coinAmount: number;
  furnitureReward: boolean;
  /** 현재 연속 출석 기준으로 이 일차까지 도달했는지. */
  claimed: boolean;
};

export type AttendanceReward = {
  itemId: number;
  name: string;
  assetKey: string;
  userItemId: number | null;
  received: boolean;
};

export type AttendanceStatus = {
  eventId: number;
  code: string;
  title: string;
  startsOn: string;
  endsOn: string;
  targetDays: number;
  currentStreak: number;
  checkedInToday: boolean;
  completed: boolean;
  checkInDates: string[];
  dailyRewards: AttendanceDailyReward[];
  reward: AttendanceReward | null;
};

export type AttendanceCheckInResult = {
  /** 이번 호출에서 오늘 출석 row를 새로 만들었는지. 멱등 재호출이면 false. */
  newCheckIn: boolean;
  /** 이번 호출에서 실제 적립한 코인. 멱등 재호출·완료 후 호출은 0. */
  coinRewardAmount: number;
  coinBalance: number;
  /** 이번 호출에서 보상 가구를 새로 지급했는지. 이미 보유했으면 false. */
  rewardGrantedNow: boolean;
  status: AttendanceStatus;
};

/**
 * GET /events/attendance — KST 오늘 진행 중인 이벤트와 내 상태.
 *
 * 진행 중인 이벤트가 없으면 **404 `ATTENDANCE_EVENT_NOT_FOUND`** 다. 그건
 * 에러가 아니라 "이벤트 없음"이므로 호출부(useAttendance)가 null로 접는다.
 */
export function fetchAttendance() {
  return apiGet<AttendanceStatus>('/events/attendance');
}

/** POST /events/attendance/check-ins — body 없이 KST 오늘 출석. 멱등. */
export function checkInAttendance() {
  return apiPost<AttendanceCheckInResult>('/events/attendance/check-ins');
}
