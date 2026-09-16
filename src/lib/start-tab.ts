import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NavTab } from '@/components/ui/bottom-nav';
import { i18n } from '@/i18n';

/** 설정 > 시작 화면 (#1139) — 앱을 열 때 처음 보일 하단 탭. 기기 보관. */
export const START_TAB_KEY = 'rougether.start-tab';
export const DEFAULT_START_TAB: NavTab = 'myRoom';
// 이름은 하단 탭 라벨과 같은 키(nav.*)를 호출 시점에 번역한다 — 모듈 로드 때 고정하면 언어 전환이 안 따라온다.
const startTabOption = (id: NavTab) => ({
  id,
  get name() {
    return i18n.t(`nav.${id}`);
  },
});
export const START_TAB_OPTIONS: { id: NavTab; readonly name: string }[] = [
  startTabOption('myRoom'),
  startTabOption('calendar'),
  startTabOption('house'),
  startTabOption('myPage'),
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
