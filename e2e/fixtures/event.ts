import type { AttendanceStatus, ChristmasEvent } from '../../src/api/events';
import type { NotificationItem, WeeklyReportSummaryItem } from '../../src/api/types';
import type { Recommendation } from '../../src/api/recommendations';
import { type List, NOW_ISO } from './common';

/**
 * 크리스마스 누적 출석(30일) — 오늘(11/19) 아직 출석하지 않아 앱이 열리면 출석 모달이 자동으로
 * 뜬다. 자동 모달은 `mode: 'CUMULATIVE'`인 상태만 받는다(`use-christmas-event`의 `usable`).
 */
const attendance = {
  eventId: 1001,
  code: 'christmas_2026_attendance',
  title: '크리스마스 출석',
  startsOn: '2026-11-17',
  endsOn: '2026-12-25',
  targetDays: 30,
  currentStreak: 2,
  mode: 'CUMULATIVE',
  progressDays: 2,
  active: true,
  availableToday: true,
  checkedInToday: false,
  completed: false,
  checkInDates: ['2026-11-17', '2026-11-18'],
  dailyRewards: Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    coinAmount: 30,
    furnitureReward: i === 29,
    claimed: i < 2,
  })),
  reward: null,
} satisfies AttendanceStatus;

/**
 * 진행 중인 크리스마스 이벤트 — 자동 출석 모달은 이 이벤트의 출석(`attendanceEventId`)이
 * 오늘 가능할 때 뜬다. 안내 팝업은 이미 닫은 것으로 둬서 출석 모달 하나만 뜬다.
 */
const christmas = {
  code: 'christmas_2026',
  title: '크리스마스 이벤트',
  active: true,
  startsOn: '2026-11-17',
  endsOn: '2026-12-25',
  gachaId: null,
  attendanceEventId: 1001,
  popupDismissed: true,
} satisfies ChristmasEvent;

type NotificationPage = { items: NotificationItem[]; nextCursor?: number; hasNext: boolean };

/** 이벤트·알림·추천·주간 리포트. */
export const EVENT_FIXTURES = {
  'GET /events/attendance': attendance,
  'GET /events/attendance/:id': attendance,
  'GET /events/christmas': christmas,
  'GET /notifications': {
    items: [
      {
        notificationId: 1101,
        type: 'ADMIN_NOTICE',
        title: '공지',
        body: 'E2E 공지',
        isRead: true,
        createdAt: NOW_ISO,
      },
    ],
    hasNext: false,
  } satisfies NotificationPage,
  'GET /recommendations': { items: [] } satisfies List<Recommendation>,
  'GET /reports/weekly': { items: [] } satisfies List<WeeklyReportSummaryItem>,
};
