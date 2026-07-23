import PostHog from 'posthog-react-native';

/**
 * 제품 분석 이벤트 레이어 (#437) — 화면·핵심 행동을 하나의 창구로 모아
 * 백엔드(PostHog, 추후 GA4 #438)로 전달한다. 계측 지점은 track/screenView만
 * 알면 되고, 어떤 도구로 나가는지는 여기서만 결정한다.
 *
 * 키가 비어 있으면 전 함수가 무동작 — 키 발급 전 머지·배포에 안전하다.
 */

/** PostHog 프로젝트 API 키 — GA 측정 ID 성격의 클라이언트 공개 키. */
const POSTHOG_API_KEY = '';
const POSTHOG_HOST = 'https://us.i.posthog.com';

/** 계측하는 핵심 이벤트 — 추가할 때 여기 유니온부터 넓힌다. */
export type AnalyticsEvent =
  | 'routine_complete'
  | 'gacha_draw'
  | 'shop_purchase'
  | 'cheer_send'
  | 'guestbook_write'
  | 'friend_room_visit'
  | 'push_open';

let client: PostHog | null = null;

/** 앱 루트에서 1회 호출 — 키가 없으면 조용히 비활성. */
export function initAnalytics() {
  if (!POSTHOG_API_KEY || client) return;
  client = new PostHog(POSTHOG_API_KEY, { host: POSTHOG_HOST });
}

/** 로그인 후 사용자 식별 — 서버 회원 id 기준(이벤트가 사용자로 묶인다). */
export function identifyUser(userId: number | string) {
  client?.identify(String(userId));
}

/** 로그아웃 — 익명 사용자로 리셋. */
export function resetAnalyticsUser() {
  client?.reset();
}

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>) {
  client?.capture(event, props);
}

/** 셸 화면 전환 추적 (탭·서브화면 공통). */
export function screenView(name: string) {
  client?.screen(name);
}
