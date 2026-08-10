import type { NavTab } from '@/components/ui/bottom-nav';

/**
 * 셸 내비게이션 상수 (#692) — 화면 목록·탭/백 매핑·엣지 백 파라미터.
 * 상태와 제스처는 use-app-navigation.ts가 소유한다.
 */
export type Screen =
  | 'myRoom'
  | 'decor'
  | 'routineManage'
  | 'addRoutine'
  | 'categoryManage'
  | 'gacha'
  | 'house'
  | 'friendRoom'
  | 'houseSearch'
  | 'createHouse'
  | 'settings'
  | 'theme'
  | 'font'
  | 'profileEdit'
  | 'passwordChange'
  | 'notificationList'
  | 'bugReport'
  | 'notifications'
  | 'sound'
  | 'help'
  | 'inviteFriends';

/** Which bottom-nav tab is active for each screen, or null to hide the nav. */
export const TAB_FOR_SCREEN: Record<Screen, NavTab | null> = {
  myRoom: 'myRoom',
  decor: null,
  routineManage: null,
  addRoutine: null,
  categoryManage: null,
  gacha: null,
  house: 'house',
  friendRoom: null,
  houseSearch: null,
  createHouse: null,
  settings: 'settings',
  theme: null,
  font: null,
  profileEdit: null,
  passwordChange: null,
  notificationList: null,
  bugReport: null,
  notifications: null,
  sound: null,
  help: null,
  inviteFriends: null,
};

export const SCREEN_FOR_TAB: Record<NavTab, Screen> = {
  myRoom: 'myRoom',
  house: 'house',
  settings: 'settings',
};

/** 하단 탭의 페이지 순서 (#563) — 페이저 인덱스 ↔ 탭 매핑. */
export const NAV_ORDER: NavTab[] = ['myRoom', 'house', 'settings'];

/**
 * Where the Android hardware back button lands from each screen. `null` on
 * myRoom = fall through to the OS default (exit the app). addRoutine is dynamic
 * (returns to wherever it was opened from) and handled separately.
 */
export const BACK_SCREEN: Record<Screen, Screen | null> = {
  myRoom: null,
  decor: 'myRoom',
  routineManage: 'myRoom',
  addRoutine: 'routineManage',
  categoryManage: 'myRoom',
  gacha: 'myRoom',
  house: 'myRoom',
  friendRoom: 'house',
  houseSearch: 'house',
  createHouse: 'houseSearch',
  settings: 'myRoom',
  theme: 'settings',
  font: 'settings',
  profileEdit: 'settings',
  passwordChange: 'settings',
  notificationList: 'myRoom',
  bugReport: 'settings',
  notifications: 'settings',
  sound: 'settings',
  help: 'settings',
  inviteFriends: 'settings',
};

/** 더블 백 종료 허용 창 (#522) — 토스트 표시와 체감이 맞는 2초. */
export const EXIT_WINDOW_MS = 2000;

/**
 * 지금 화면의 뒤로 목적지 (#522 하드웨어 백 · #564 엣지 백 공용). null이면
 * 루트(뒤로 갈 곳 없음). addRoutine은 연 곳으로, 집 없는 유저의 탐색 직행은
 * 빈 집 화면으로 되돌리지 않는다 (#571).
 */
export function backTargetFor(
  screen: Screen,
  addReturnScreen: Screen,
  noHouses: boolean,
): Screen | null {
  if (screen === 'addRoutine') return addReturnScreen;
  if (screen === 'houseSearch' && noHouses) return 'myRoom';
  return BACK_SCREEN[screen];
}

// iOS 엣지 스와이프 백 (#564) — 왼쪽 이 폭 안에서 시작한 우향 팬만.
export const EDGE_BACK_WIDTH = 28;
// 이만큼 끌었거나(거리) 이 속도를 넘긴 릴리즈면 뒤로 간다.
export const EDGE_BACK_DISTANCE = 64;
export const EDGE_BACK_VELOCITY = 700;
