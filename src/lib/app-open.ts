import { Linking } from 'react-native';

import { track } from '@/lib/analytics';

/**
 * 재방문 계기 계측 (#803) — 앱을 **왜** 다시 열었는지를 셋으로 가른다.
 *
 * 습관 앱의 성패는 "둘째 날 다시 여는가"인데, 무엇이 그 재방문을 만들었는지
 * 모르면 다음에 어디에 투자할지(푸시 문구? 위젯? 보상?) 정할 수 없다. GA4의
 * 자동 세션 집계는 "다시 왔다"까지만 말해준다.
 *
 * - `push`  — 알림 탭 (기존 push_open을 흡수)
 * - `widget` — 홈 화면 위젯 탭 (딥링크 `rougether://widget`)
 * - `direct` — 그 외 (아이콘·멀티태스킹 등)
 */
export type AppOpenSource = 'push' | 'widget' | 'direct';

/** 위젯 탭이 앱을 열 때 쓰는 딥링크 — 위젯 렌더 코드와 이 값을 공유한다. */
export const WIDGET_OPEN_URL = 'rougether://widget';

let reported = false;

/** 실행당 1회만 — 계기는 앱을 연 그 순간 하나뿐이다. */
export function reportAppOpen(source: AppOpenSource) {
  if (reported) return;
  reported = true;
  track('app_open', { source });
}

/**
 * 콜드 스타트의 계기를 판정한다. 푸시 탭은 알림 핸들러가 먼저 잡으므로
 * (use-my-room-pages) 여기서는 위젯 딥링크와 직접 실행만 가른다.
 */
export async function detectAppOpenSource() {
  try {
    const url = await Linking.getInitialURL();
    reportAppOpen(url?.startsWith(WIDGET_OPEN_URL) ? 'widget' : 'direct');
  } catch {
    reportAppOpen('direct');
  }
}
