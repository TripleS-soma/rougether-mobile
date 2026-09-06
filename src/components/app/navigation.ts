import type { NavTab } from '@/components/ui/bottom-nav';

/**
 * 셸 내비게이션 상수 (#692) — 화면 목록·탭/백 매핑·엣지 백 파라미터.
 * 상태와 제스처는 use-app-navigation.ts가 소유한다.
 */
export type Screen =
  | 'myRoom'
  | 'calendar'
  | 'decor'
  | 'routineManage'
  | 'addRoutine'
  | 'categoryManage'
  | 'gacha'
  | 'house'
  | 'houseMembers'
  | 'houseMissions'
  | 'friendRoom'
  | 'houseSearch'
  | 'createHouse'
  | 'myPage'
  | 'settings'
  | 'theme'
  | 'font'
  | 'profileEdit'
  | 'notificationList'
  | 'calendarImport'
  | 'bugReport'
  | 'notifications'
  | 'sound'
  | 'help'
  | 'inviteFriends'
  | 'weeklyReport';

/** Which bottom-nav tab is active for each screen, or null to hide the nav. */
export const TAB_FOR_SCREEN: Record<Screen, NavTab | null> = {
  myRoom: 'myRoom',
  // 달력 탭 (#1138) — 나의 방의 달력 뷰가 독립 탭으로.
  calendar: 'calendar',
  decor: null,
  routineManage: null,
  addRoutine: null,
  categoryManage: null,
  gacha: null,
  house: 'house',
  houseMembers: null,
  houseMissions: null,
  friendRoom: null,
  houseSearch: null,
  createHouse: null,
  // 마이페이지 탭 (#1088) — 설정은 그 안의 서브화면이 됐다.
  myPage: 'myPage',
  settings: null,
  theme: null,
  font: null,
  profileEdit: null,
  notificationList: null,
  calendarImport: null,
  bugReport: null,
  notifications: null,
  sound: null,
  help: null,
  inviteFriends: null,
  weeklyReport: null,
};

export const SCREEN_FOR_TAB: Record<NavTab, Screen> = {
  myRoom: 'myRoom',
  calendar: 'calendar',
  house: 'house',
  myPage: 'myPage',
};

/** 하단 탭의 페이지 순서 (#563) — 페이저 인덱스 ↔ 탭 매핑. */
export const NAV_ORDER: NavTab[] = ['myRoom', 'calendar', 'house', 'myPage'];

/**
 * Where the Android hardware back button lands from each screen. `null` on
 * myRoom = fall through to the OS default (exit the app). addRoutine is dynamic
 * (returns to wherever it was opened from) and handled separately.
 */
export const BACK_SCREEN: Record<Screen, Screen | null> = {
  myRoom: null,
  calendar: 'myRoom',
  decor: 'myRoom',
  routineManage: 'myRoom',
  addRoutine: 'routineManage',
  categoryManage: 'myRoom',
  gacha: 'myRoom',
  house: 'myRoom',
  houseMembers: 'house',
  houseMissions: 'house',
  friendRoom: 'house',
  houseSearch: 'house',
  createHouse: 'houseSearch',
  myPage: 'myRoom',
  // 설정은 마이페이지의 서브화면 (#1088); 계정·콘텐츠성 화면은 마이페이지로 돌아간다.
  settings: 'myPage',
  theme: 'settings',
  font: 'settings',
  profileEdit: 'myPage',
  notificationList: 'myRoom',
  calendarImport: 'myPage',
  bugReport: 'myPage',
  notifications: 'settings',
  sound: 'settings',
  help: 'myPage',
  inviteFriends: 'myPage',
  // 마이페이지에서도, 새 회고 배너에서도 열린다 — 실제 목적지는 addReturnScreen (#1056).
  weeklyReport: 'myPage',
};

/** 더블 백 종료 허용 창 (#522) — 토스트 표시와 체감이 맞는 2초. */
export const EXIT_WINDOW_MS = 2000;

/**
 * 지금 화면의 뒤로 목적지 (#522 하드웨어 백 · #564 엣지 백 공용). null이면
 * 루트(뒤로 갈 곳 없음). addRoutine·weeklyReport는 연 곳으로(#1056), 집 없는
 * 유저의 탐색 직행은 빈 집 화면으로 되돌리지 않는다 (#571).
 */
export function backTargetFor(
  screen: Screen,
  addReturnScreen: Screen,
  noHouses: boolean,
): Screen | null {
  if (screen === 'addRoutine' || screen === 'weeklyReport') return addReturnScreen;
  if (screen === 'houseSearch' && noHouses) return 'myRoom';
  return BACK_SCREEN[screen];
}

// iOS 엣지 스와이프 백 (#564) — 왼쪽 이 폭 안에서 시작한 우향 팬만. #1135부터는
// 아래 제외 화면이 아니면 **화면 어디서나** 우향 스와이프로 뒤로 간다(전폭).
export const EDGE_BACK_WIDTH = 28;
/**
 * 전폭 스와이프 백을 쓰지 않는 서브화면 (#1135) — 가로 제스처를 스스로 쓰는 곳.
 * 여기서는 종전대로 왼쪽 가장자리 시작만 뒤로 간다.
 * - friendRoom: 좌우 스와이프로 친구 순회(#644)
 * - decor: 가구 드래그 배치
 * - gacha: 머신 가로 스크롤
 * - addRoutine: 추천·요일 칩 가로 스크롤
 */
export const FULL_SWIPE_BACK_EXCLUDED: ReadonlySet<Screen> = new Set<Screen>([
  'friendRoom',
  'decor',
  'gacha',
  'addRoutine',
]);
// 이만큼 끌었거나(거리) 이 속도를 넘긴 릴리즈면 뒤로 간다.
export const EDGE_BACK_DISTANCE = 64;
export const EDGE_BACK_VELOCITY = 700;
