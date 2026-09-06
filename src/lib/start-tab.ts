import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NavTab } from '@/components/ui/bottom-nav';

/** 설정 > 시작 화면 (#1139) — 앱을 열 때 처음 보일 하단 탭. 기기 보관. */
export const START_TAB_KEY = 'rougether.start-tab';
export const DEFAULT_START_TAB: NavTab = 'myRoom';
export const START_TAB_OPTIONS: { id: NavTab; name: string }[] = [
  { id: 'myRoom', name: '나의 방' },
  { id: 'calendar', name: '달력' },
  { id: 'house', name: '집' },
  { id: 'myPage', name: '마이페이지' },
];

export function isNavTab(value: unknown): value is NavTab {
  return START_TAB_OPTIONS.some((o) => o.id === value);
}

/** 저장값이 없거나 깨졌으면 기본(나의 방). */
export async function readStartTab(): Promise<NavTab> {
  try {
    const raw = await AsyncStorage.getItem(START_TAB_KEY);
    return isNavTab(raw) ? raw : DEFAULT_START_TAB;
  } catch {
    return DEFAULT_START_TAB;
  }
}

export async function writeStartTab(tab: NavTab): Promise<void> {
  try {
    await AsyncStorage.setItem(START_TAB_KEY, tab);
  } catch {
    // 보관 실패는 다음 실행에 기본으로 열릴 뿐 — 조용히.
  }
}
