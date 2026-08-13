import { AppState, Linking } from 'react-native';

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

/**
 * 백그라운드에 이만큼 있다 돌아오면 새 방문으로 본다 — GA4 세션 경계와 같은
 * 30분. 이 문턱이 없으면 다른 앱 잠깐 다녀온 것까지 `direct`로 세서, 푸시·위젯
 * 대비 direct가 부풀어 "무엇이 재방문을 만드는가" 비교가 망가진다.
 */
const NEW_VISIT_GAP_MS = 30 * 60 * 1000;

let reportedThisForeground = false;
let backgroundedAt: number | null = null;

/** 콜드 스타트이거나, 충분히 오래 나가 있다 돌아온 경우. */
function isNewVisit() {
  return backgroundedAt === null || Date.now() - backgroundedAt >= NEW_VISIT_GAP_MS;
}

/**
 * 계기 1건 보고. 한 번의 포그라운드에서 한 번만 — 푸시 핸들러와 딥링크 처리가
 * 같은 진입을 두 번 세지 않게 한다.
 *
 * 명시적 계기(푸시·위젯)는 언제나 센다: 그게 바로 측정하려는 대상이다.
 * `direct`만 30분 문턱을 적용해 앱 전환 복귀를 걸러낸다.
 */
export function reportAppOpen(source: AppOpenSource) {
  if (reportedThisForeground) return;
  if (source === 'direct' && !isNewVisit()) return;
  reportedThisForeground = true;
  track('app_open', { source });
}

/** 딥링크가 위젯에서 온 것인지. */
function isWidgetUrl(url: string | null | undefined) {
  return !!url && url.startsWith(WIDGET_OPEN_URL);
}

/**
 * 앱 시작 시 1회 배선. 콜드 스타트 계기를 판정하고, 이후 포그라운드 복귀와
 * 딥링크 수신을 계속 지켜본다 — 위젯 탭의 대부분은 앱이 이미 떠 있는 상태에서
 * 일어나므로 콜드 스타트만 보면 위젯의 기여가 통째로 빠진다.
 */
export function initAppOpenTracking() {
  Linking.getInitialURL()
    .then((url) => reportAppOpen(isWidgetUrl(url) ? 'widget' : 'direct'))
    .catch(() => reportAppOpen('direct'));

  Linking.addEventListener('url', ({ url }) => {
    if (isWidgetUrl(url)) reportAppOpen('widget');
  });

  AppState.addEventListener('change', (state) => {
    if (state === 'background') {
      backgroundedAt = Date.now();
      // 다음 진입은 다시 셀 수 있게 연다.
      reportedThisForeground = false;
    } else if (state === 'active' && isNewVisit()) {
      // 위젯·푸시로 돌아왔다면 그쪽 핸들러가 먼저 보고하고 여기선 침묵한다.
      setTimeout(() => reportAppOpen('direct'), 0);
    }
  });
}
