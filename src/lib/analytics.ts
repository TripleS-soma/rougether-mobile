import { Platform } from 'react-native';

/**
 * 제품 분석 이벤트 레이어 (#437·#438 → #799) — 화면·핵심 행동을 하나의 창구로
 * 모아 **Firebase GA4**로 전달한다. 계측 지점은 track/screenView만 알면 되고,
 * 어떤 도구로 나가는지는 여기서만 결정한다.
 *
 * 도구 단일화 (#799): PostHog를 걷어내고 GA4만 남겼다 — 같은 이벤트를 두 곳에
 * 흘리면 숫자가 갈라지고, 어느 쪽을 믿을지 매번 판단해야 한다. 에러·크래시는
 * 분석이 아니라 Sentry(`lib/error-reporting.ts`) 소관이다.
 *
 * Firebase(GA4)는 네이티브 전용이라 웹·Expo Go에서는 조용히 비활성된다 — 분석은
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
  /** 꾸미기 화면 진입 (#1043) — from: 'gacha'(뽑은 것 배치하러) | 'direct'(나의 방·미션). */
  | 'decor_open'
  /** 꾸미기 세션의 첫 가구 배치 (#1043) — 마운트당 1회. decor_open→decor_place→room_save 퍼널. */
  | 'decor_place'
  // 재방문 계기 (#803) — 앱을 다시 연 이유를 셋으로 가른다: 푸시/위젯/직접.
  // push_open을 이 이벤트로 흡수했다 — 계기가 세 갈래인데 이벤트가 하나만
  // 있으면 "푸시로 온 사람 수"는 알아도 "그냥 연 사람 수"를 못 센다.
  | 'app_open'
  // 소셜 — 집에 들어간 사람이 더 오래 남는가 (#803)
  | 'house_preview'
  | 'house_create'
  | 'house_join_request'
  | 'house_joined'
  | 'invite_code_copy'
  | 'invite_redeem'
  // 그 밖의 핵심 행동
  | 'shop_purchase'
  | 'cheer_send'
  | 'guestbook_write'
  | 'friend_room_visit'
  | 'onboarding_mission_start'
  | 'onboarding_mission_complete'
  | 'onboarding_mission_skip'
  // 이탈 원인
  | 'login_failed'
  /**
   * 같은 이메일 타 provider 안내(서버 409) — provider: 시도한 쪽, existing: 이미 가입된 쪽('apple|google').
   * 빈 새 계정이 조용히 생기던 사고의 대응이라 얼마나 자주 뜨는지·어느 쪽을 고르는지가 핵심 지표.
   */
  | 'login_conflict'
  /** 안내에서 [새 계정으로 계속]을 고름 — [OO로 로그인]은 그 provider 의 login_success 로 잡힌다. */
  | 'login_conflict_continue'
  | 'purchase_blocked'
  | 'api_error';

// RNFirebase는 네이티브 전용 — 지연 require로 웹 번들에서 평가되지 않게 한다
// (push-token.ts와 같은 계약). 네이티브 모듈이 없으면(Expo Go, 웹, 구버전
// 빌드) require/초기화가 던지므로 전부 try/catch 뒤 — 분석·크래시 리포팅은
// 어떤 경우에도 앱을 죽이면 안 된다.
type GaModule = typeof import('@react-native-firebase/analytics');
let gaMod: GaModule | null = null;
let ga: ReturnType<GaModule['getAnalytics']> | null = null;

function initFirebase(collect: boolean) {
  if (Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    gaMod = require('@react-native-firebase/analytics') as GaModule;
    ga = gaMod.getAnalytics();
    if (!collect) {
      /**
       * 개발 빌드는 수집 자체를 끈다 (#954).
       *
       * 우리 `logEvent`만 막으면 부족하다 — **SDK의 자동 이벤트**
       * (`first_open`·`session_start`·`screen_view`)는 네이티브에서 그대로
       * 올라가고, 지표를 흐리는 게 정확히 그 `first_open`이다(GA4의 "새
       * 사용자"는 로그인이 아니라 설치 후 첫 실행 기준이라, 개발 중 재설치
       * 한 번이 새 사용자 한 명이 된다).
       *
       * 한계: 이 호출은 네이티브 초기화 **뒤**에 실행되므로 새로 설치한
       * 개발 빌드의 첫 `first_open` 하나는 빠져나갈 수 있다. 설정은 기기에
       * 저장돼 다음 실행부터 유지되므로 기기당 최대 1건이다. 완전 차단은
       * 매니페스트/plist 플래그인데 그건 네이티브 지문을 바꾼다.
       */
      void gaMod.setAnalyticsCollectionEnabled(ga, false).catch(() => {});
      // 우리 이벤트 경로도 닫는다 — track/screenView/identifyUser가 전부
      // `ga` null을 보고 조용히 no-op이 된다.
      ga = null;
    }
  } catch {
    gaMod = null;
    ga = null;
  }
}

let initialized = false;

/**
 * 앱 루트에서 1회 호출 — 키가 없거나 초기화가 실패하면 조용히 비활성.
 * 분석은 어떤 경우에도 앱을 죽이면 안 된다.
 *
 * `collect`는 기본이 `!__DEV__`다 — 개발 빌드의 재설치가 GA4 새 사용자로
 * 잡히던 것을 막는다 (#954). 옆의 Sentry는 이미 같은 규칙이다
 * (`error-reporting.ts` — `enabled: !__DEV__`).
 *
 * jest는 `__DEV__`가 true라 테스트가 켜짐 경로를 보려면 명시해야 한다.
 */
export function initAnalytics(options?: { collect?: boolean }) {
  if (initialized) return;
  initialized = true;
  initFirebase(options?.collect ?? !__DEV__);
}

/** 로그인 후 사용자 식별 — 서버 회원 id 기준(이벤트가 사용자로 묶인다). */
export function identifyUser(userId: number | string) {
  try {
    if (ga && gaMod) void gaMod.setUserId(ga, String(userId)).catch(() => {});
  } catch {
    // no-op
  }
}

/** 로그아웃 — 익명 사용자로 리셋. */
export function resetAnalyticsUser() {
  try {
    if (ga && gaMod) void gaMod.setUserId(ga, null).catch(() => {});
  } catch {
    // no-op
  }
}

/**
 * GA4가 **구조를 정해둔 예약 파라미터** — 이름만 같아도 네이티브가 그 타입으로
 * 캐스팅한다. `items`에 숫자를 넘겼다가 양 플랫폼에서 터졌다 (#912):
 *   iOS      `-[__NSCFNumber enumerateObjectsUsingBlock:]: unrecognized selector`
 *   Android  `java.lang.Double cannot be cast to ReadableArray`
 * 이벤트 하나 때문에 앱이 죽으면 안 되므로, 보내기 전에 막고 이름을 바꾼다.
 */
const RESERVED_PARAMS = new Set(['items', 'extend_session']);

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>) {
  try {
    // GA4 이벤트 이름 규칙(영소문자+언더스코어)은 AnalyticsEvent 유니온이 보장.
    if (!ga || !gaMod) return;
    const safe = props && sanitize(props);
    // 거부가 try/catch를 빠져나가 unhandled rejection이 된 적이 있다 (#912).
    // RNFB 26의 모듈러 `logEvent`는 내부 프로미스를 `void`로 버려 잡을 자리가
    // 없으므로(#1031), Promise를 돌려주는 인스턴스 메서드를 직접 부른다.
    void ga.logEvent(event, safe).catch(() => {});
  } catch {
    // no-op
  }
}

/** 예약 파라미터는 접두를 붙여 피한다 — 버리면 계측이 조용히 비고, 그대로 두면 죽는다. */
function sanitize(props: Record<string, string | number | boolean>) {
  let hit = false;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (RESERVED_PARAMS.has(k)) {
      hit = true;
      out[`app_${k}`] = v;
    } else out[k] = v;
  }
  return hit ? out : props;
}

/** 셸 화면 전환 추적 (탭·서브화면 공통). */
export function screenView(name: string) {
  try {
    if (ga && gaMod)
      void gaMod.logScreenView(ga, { screen_name: name, screen_class: name }).catch(() => {});
  } catch {
    // no-op
  }
}
