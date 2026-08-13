import { Platform } from 'react-native';

/**
 * 제품 분석 이벤트 레이어 (#437·#438 → #799) — 화면·핵심 행동을 하나의 창구로
 * 모아 **Firebase GA4**로 전달한다. 계측 지점은 track/screenView만 알면 되고,
 * 어떤 도구로 나가는지는 여기서만 결정한다.
 *
 * 도구 단일화 (#799): PostHog를 걷어내고 GA4만 남겼다 — 같은 이벤트를 두 곳에
 * 흘리면 숫자가 갈라지고, 어느 쪽을 믿을지 매번 판단해야 한다. 에러·크래시는
 * 분석이 아니라 Sentry(도입 예정)/Crashlytics 소관이다.
 *
 * Firebase는 네이티브 전용이라 웹·Expo Go에서는 조용히 비활성된다 — 분석은
 * 어떤 경우에도 앱을 죽이면 안 된다는 게 이 파일의 계약이다.
 */

/**
 * 계측하는 이벤트 — 추가할 때 여기 유니온부터 넓힌다.
 *
 * **퍼널** (#799): 설치 → `login_success` → `onboarding_complete` →
 * `routine_create` → `routine_complete` → `gacha_draw` → `room_save` → 재방문.
 * "첫 …" 은 이벤트를 따로 만들지 않는다 — GA4에서 사용자별 최초 발생으로 보면
 * 되고, 앱이 first 여부를 따로 기억하면 기기 교체·재설치에서 어긋난다.
 *
 * **실패**: 통과 이벤트만 보면 "어디서 빠졌는지"는 알아도 "왜"를 모른다.
 * 에러로 터지지 않고 조용히 포기하는 순간(로그인 취소·잔액 부족)이 특히 그렇다.
 */
export type AnalyticsEvent =
  // 퍼널
  | 'login_success'
  | 'onboarding_complete'
  | 'routine_create'
  | 'routine_complete'
  | 'gacha_draw'
  | 'room_save'
  // 그 밖의 핵심 행동
  | 'shop_purchase'
  | 'cheer_send'
  | 'guestbook_write'
  | 'friend_room_visit'
  | 'push_open'
  | 'onboarding_mission_start'
  | 'onboarding_mission_complete'
  | 'onboarding_mission_skip'
  // 이탈 원인
  | 'login_failed'
  | 'purchase_blocked'
  | 'api_error';

// RNFirebase는 네이티브 전용 — 지연 require로 웹 번들에서 평가되지 않게 한다
// (push-token.ts와 같은 계약). 네이티브 모듈이 없으면(Expo Go, 웹, 구버전
// 빌드) require/초기화가 던지므로 전부 try/catch 뒤 — 분석·크래시 리포팅은
// 어떤 경우에도 앱을 죽이면 안 된다.
type GaModule = typeof import('@react-native-firebase/analytics');
type CrashModule = typeof import('@react-native-firebase/crashlytics');
let gaMod: GaModule | null = null;
let ga: ReturnType<GaModule['getAnalytics']> | null = null;
let crashMod: CrashModule | null = null;
let crash: ReturnType<CrashModule['getCrashlytics']> | null = null;

/** RN 전역 ErrorUtils — JS 최상위 에러 핸들러 훅 (타입은 전역 선언에 없어 국소 정의). */
type RnErrorUtils = {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

/**
 * 처리되지 않은 JS 에러를 Crashlytics에 남긴다 — 네이티브 크래시는 SDK가
 * 자동 수집하지만 JS 에러(빨간 화면/무한 로딩류)는 명시적 recordError가 필요.
 * 기존 핸들러(RN 기본 or 다른 도구)는 반드시 이어서 호출한다.
 */
function installJsErrorHandler() {
  const errorUtils = (globalThis as { ErrorUtils?: RnErrorUtils }).ErrorUtils;
  if (!errorUtils || !crash || !crashMod) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    try {
      if (crash && crashMod) {
        const err = error instanceof Error ? error : new Error(String(error));
        void crashMod.recordError(crash, err, isFatal ? 'FatalJsError' : 'JsError');
      }
    } catch {
      // 리포팅 실패는 무시 — 원래 핸들러 체인은 계속 탄다.
    }
    previous?.(error, isFatal);
  });
}

function initFirebase() {
  if (Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    gaMod = require('@react-native-firebase/analytics') as GaModule;
    ga = gaMod.getAnalytics();
  } catch {
    gaMod = null;
    ga = null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    crashMod = require('@react-native-firebase/crashlytics') as CrashModule;
    crash = crashMod.getCrashlytics();
    installJsErrorHandler();
  } catch {
    crashMod = null;
    crash = null;
  }
}

let initialized = false;

/** 앱 루트에서 1회 호출 — 키가 없거나 초기화가 실패하면 조용히 비활성.
 * 분석은 어떤 경우에도 앱을 죽이면 안 된다. */
export function initAnalytics() {
  if (initialized) return;
  initialized = true;
  initFirebase();
}

/** 로그인 후 사용자 식별 — 서버 회원 id 기준(이벤트가 사용자로 묶인다). */
export function identifyUser(userId: number | string) {
  try {
    if (ga && gaMod) void gaMod.setUserId(ga, String(userId));
    if (crash && crashMod) void crashMod.setUserId(crash, String(userId));
  } catch {
    // no-op
  }
}

/** 로그아웃 — 익명 사용자로 리셋. */
export function resetAnalyticsUser() {
  try {
    if (ga && gaMod) void gaMod.setUserId(ga, null);
    if (crash && crashMod) void crashMod.setUserId(crash, '');
  } catch {
    // no-op
  }
}

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>) {
  try {
    // GA4 이벤트 이름 규칙(영소문자+언더스코어)은 AnalyticsEvent 유니온이 보장.
    if (ga && gaMod) void gaMod.logEvent(ga, event, props);
  } catch {
    // no-op
  }
}

/** 셸 화면 전환 추적 (탭·서브화면 공통). */
export function screenView(name: string) {
  try {
    if (ga && gaMod) void gaMod.logScreenView(ga, { screen_name: name, screen_class: name });
  } catch {
    // no-op
  }
}
