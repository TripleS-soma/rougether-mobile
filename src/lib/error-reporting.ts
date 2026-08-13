import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

/**
 * 에러 리포팅 (#801) — Sentry. 분석(`lib/analytics.ts`, GA4)과 창구를 나눈다:
 * **무엇을 했는가는 GA4, 무엇이 깨졌는가는 Sentry**.
 *
 * Crashlytics 대신 Sentry를 쓰는 이유는 소스맵이다. 릴리스 번들은 압축돼 있어
 * `index.android.bundle:1:284915` 같은 스택만 남는데, Sentry는 EAS 빌드·OTA
 * 발행 시 소스맵을 올려 원본 파일·줄로 되읽어 준다. 어떤 OTA 업데이트에서 난
 * 에러인지도 같이 붙는다 — 채널·런타임이 갈리는 이 앱에서 특히 중요하다.
 *
 * DSN이 비어 있으면 전 함수 무동작 — 키 없이도 머지·테스트가 안전하다.
 */

/** 클라이언트 공개 값 — 비밀이 아니다(코드 서명·전송 대상 식별용). */
const SENTRY_DSN =
  'https://08906c3e88d91e8ea4809f90f8a883a6@o4511901764354048.ingest.us.sentry.io/4511901770252288';

let started = false;

/**
 * 앱 시작 시 1회. 샘플링은 **의도적으로 보수적**이다 — 무료 플랜은 월 5천 에러·
 * 리플레이 50이고, 트레이싱·리플레이를 켜면 한도보다 노이즈가 먼저 문제가 된다.
 * 지금 필요한 건 "무엇이 깨졌나" 하나다.
 */
export function initErrorReporting() {
  if (started || !SENTRY_DSN) return;
  started = true;
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      // 개발 중 로컬 에러까지 서버로 보내면 신호가 흐려진다.
      enabled: !__DEV__,
      // dev/preview/production 레인을 Sentry에서도 갈라 본다.
      environment: __DEV__ ? 'development' : 'production',
      // 성능 트레이싱·리플레이는 끈다 (위 주석 참고).
      tracesSampleRate: 0,
      // 기본 PII(IP·기기 식별자 등) 수집 안 함 — 사용자 식별은 서버 회원 id만.
      sendDefaultPii: false,
    });
  } catch {
    // 리포팅 초기화 실패가 앱을 죽이면 안 된다 — analytics.ts와 같은 계약.
    started = false;
  }
}

/** 로그인 후 — 에러를 사용자 단위로 묶는다(서버 회원 id, 가명 식별자). */
export function setErrorUser(userId: number | string) {
  try {
    Sentry.setUser({ id: String(userId) });
  } catch {
    // no-op
  }
}

/** 로그아웃 — 이후 에러가 이전 사용자에게 붙지 않게 끊는다. */
export function clearErrorUser() {
  try {
    Sentry.setUser(null);
  } catch {
    // no-op
  }
}

/**
 * 삼켜지는 예외를 남긴다 — catch로 잡아 토스트만 띄우고 넘어가는 자리에서,
 * 사용자에게는 조용하지만 우리는 알아야 할 때.
 */
export function reportError(error: unknown, context?: Record<string, string | number | boolean>) {
  try {
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
      tags: { platform: Platform.OS },
      extra: context,
    });
  } catch {
    // no-op
  }
}
