import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { API_BASE } from '@/api/config';
import { normalizeDiagnosticsPath } from '@/lib/diagnostics-log';

/**
 * 에러 리포팅·성능 추적 (#801, #1376) — Sentry. 분석(`lib/analytics.ts`, GA4)과 창구를 나눈다:
 * **무엇을 했는가는 GA4, 무엇이 깨졌고 무엇이 느린가는 Sentry**. 운영 규칙은
 * `docs/observability.md`.
 *
 * Crashlytics 대신 Sentry를 쓰는 이유는 소스맵이다. 릴리스 번들은 압축돼 있어
 * `index.android.bundle:1:284915` 같은 스택만 남는데, Sentry는 EAS 빌드·OTA
 * 발행 시 소스맵을 올려 원본 파일·줄로 되읽어 준다. 어떤 OTA 업데이트에서 난
 * 에러인지도 같이 붙는다(expo-updates 컨텍스트, SDK 자동).
 *
 * DSN이 비어 있으면 전 함수 무동작 — 키 없이도 머지·테스트가 안전하다.
 */

/** 클라이언트 공개 값 — 비밀이 아니다(코드 서명·전송 대상 식별용). */
const SENTRY_DSN =
  'https://08906c3e88d91e8ea4809f90f8a883a6@o4511901764354048.ingest.us.sentry.io/4511901770252288';

/** 웹앱 운영 호스트 — 그 외 호스트(로컬 8081·미리보기)는 개발 레인. */
const WEB_PRODUCTION_HOST = 'app.rougether.com';

export type ReportingLane = {
  /** Sentry environment — 이슈·성능을 레인별로 가른다. */
  environment: string;
  /** 트랜잭션(화면 전환·앱 시작) 샘플링 비율. 에러는 샘플링하지 않는다. */
  tracesSampleRate: number;
  /** 태그용 채널 이름(웹은 'web'). */
  channel: string;
};

/**
 * 운영 레인의 트레이스 샘플링 (#1376). Sentry 무료(Developer) 플랜의 스팬 한도는 월 5M.
 * DAU 수십 명·세션당 수백 스팬 기준 100%여도 월 100만대라 한도 안이지만, 글로벌 출시(#1369)로
 * 사용자가 열 배 늘어도 한도를 넘지 않게 20%로 둔다. 근거·재산정은 docs/observability.md.
 */
export const PRODUCTION_TRACES_SAMPLE_RATE = 0.2;

/**
 * 실행 중인 바이너리·호스트로 레인을 정한다 (#1376). 순수 함수 — 테스트는 인자로 부른다.
 *
 * - 네이티브: 채널은 바이너리에 박힌다. `production`과 `dev`(2026-09-16 재배선으로 스토어
 *   레인, 심사 제출된 빌드 125가 이 채널)는 운영, `internal`은 개발 레인, 채널이 없으면
 *   (개발 빌드·Expo Go) `unknown`.
 * - 웹: `app.rougether.com`만 운영(`web-production`), 나머지는 `web-dev`.
 */
export function resolveReportingLane(
  os: string,
  channel: string | null | undefined,
  hostname: string | undefined,
): ReportingLane {
  if (os === 'web') {
    const production = hostname === WEB_PRODUCTION_HOST;
    return {
      environment: production ? 'web-production' : 'web-dev',
      tracesSampleRate: production ? PRODUCTION_TRACES_SAMPLE_RATE : 1,
      channel: 'web',
    };
  }
  if (channel === 'production' || channel === 'dev') {
    return { environment: 'production', tracesSampleRate: PRODUCTION_TRACES_SAMPLE_RATE, channel };
  }
  if (channel === 'internal') {
    return { environment: 'internal', tracesSampleRate: 1, channel };
  }
  return { environment: 'unknown', tracesSampleRate: 1, channel: channel ?? 'none' };
}

/**
 * URL에서 식별 가능한 값을 걷어낸다 (#1376) — 쿼리 문자열(초대코드·날짜 등)을 통째로 지우고
 * 경로의 식별자(숫자 id·UUID·초대코드 같은 영숫자)는 `{id}`로. 스팬 설명·브레드크럼에 붙는 요청 주소가 그대로 Sentry로
 * 가지 않게. GA4 `api_error`·버그 제보 진단 기록과 같은 규칙(`normalizeDiagnosticsPath`).
 */
export function scrubUrl(url: string): string {
  return normalizeDiagnosticsPath(url);
}

/** 스팬을 만들 요청인가 — 우리 API만. 이미지 CDN·소셜 SDK·개발 서버 요청은 제외. */
export function isApiRequest(url: string): boolean {
  return url.startsWith(API_BASE);
}

/**
 * 화면 전환 추적 (#1376) — Expo Router의 내비게이션 컨테이너를 루트 레이아웃이 등록한다
 * (`registerNavigationContainer`). 앱 시작 1회에만 만든다.
 */
let navigationIntegration: ReturnType<typeof Sentry.reactNavigationIntegration> | null = null;

let started = false;

/**
 * 앱 시작 시 1회.
 *
 * - 에러: 전량. 개발 중(`__DEV__`)에는 보내지 않는다 — 신호가 흐려진다.
 * - 성능: 레인별 샘플링(`resolveReportingLane`). 화면 전환·앱 시작(네이티브)·느린/멈춘
 *   프레임(네이티브)·API 요청 구간.
 * - **트레이스 헤더 전파는 끈다**(`tracePropagationTargets: []`). 서버에 Sentry가 없어 이어 볼
 *   곳이 없고, 서버 CORS 허용 헤더가 `Authorization·Content-Type·Accept·Origin`뿐이라 웹에서
 *   `sentry-trace`·`baggage`를 붙이면 사전 요청(preflight)이 거부돼 API 전체가 막힌다.
 * - 리플레이는 끈다(무료 50회, 개인정보 마스킹 검증 전).
 */
export function initErrorReporting() {
  if (started || !SENTRY_DSN) return;
  started = true;
  try {
    const lane = resolveReportingLane(
      Platform.OS,
      Platform.OS === 'web' ? null : Updates.channel,
      (globalThis as { location?: { hostname?: string } }).location?.hostname,
    );
    navigationIntegration = Sentry.reactNavigationIntegration({
      // 화면 첫 렌더까지(TTI)는 네이티브 프레임 정보가 있을 때만 의미가 있다.
      enableTimeToInitialDisplay: Platform.OS !== 'web',
      // 탭 페이저·뒤로가기처럼 화면이 바뀌지 않는 전환은 빈 트랜잭션을 만들지 않는다.
      ignoreEmptyBackNavigationTransactions: true,
    });
    Sentry.init({
      dsn: SENTRY_DSN,
      enabled: !__DEV__,
      environment: lane.environment,
      tracesSampleRate: lane.tracesSampleRate,
      tracePropagationTargets: [],
      integrations: [
        navigationIntegration,
        Sentry.reactNativeTracingIntegration({ shouldCreateSpanForRequest: isApiRequest }),
      ],
      // 기본 PII(IP·기기 식별자 등) 수집 안 함 — 사용자 식별은 서버 회원 id만.
      sendDefaultPii: false,
      beforeBreadcrumb(breadcrumb) {
        const url = breadcrumb.data?.url;
        if (typeof url === 'string') {
          return { ...breadcrumb, data: { ...breadcrumb.data, url: scrubUrl(url) } };
        }
        return breadcrumb;
      },
      beforeSendSpan(span) {
        if (span.description && /^https?:\/\//.test(span.description.split(' ').pop() ?? '')) {
          const parts = span.description.split(' ');
          parts[parts.length - 1] = scrubUrl(parts[parts.length - 1]);
          span.description = parts.join(' ');
        }
        const data = span.data as Record<string, unknown> | undefined;
        if (data) {
          for (const key of ['url', 'http.url', 'http.query', 'http.fragment']) {
            if (typeof data[key] === 'string') {
              data[key] =
                key === 'http.query' || key === 'http.fragment' ? '' : scrubUrl(data[key]);
            }
          }
        }
        return span;
      },
    });
    Sentry.setTag('channel', lane.channel);
    Sentry.setTag('platform', Platform.OS);
  } catch {
    // 리포팅 초기화 실패가 앱을 죽이면 안 된다 — analytics.ts와 같은 계약.
    started = false;
  }
}

/**
 * 루트 레이아웃이 Expo Router의 내비게이션 컨테이너를 넘긴다 (#1376). 초기화 전이거나
 * 실패했으면 무동작.
 */
export function registerNavigationContainer(ref: unknown) {
  try {
    navigationIntegration?.registerNavigationContainer(ref);
  } catch {
    // no-op
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

/**
 * 앱 언어 태그 (#1369) — 영어 UI에서만 나는 크래시(레이아웃·문구 길이·로케일 포맷)를
 * 이슈 목록에서 `app_language:en`으로 걸러 보기 위해. 분석의 user property와 짝.
 */
export function setErrorLanguage(language: string) {
  try {
    Sentry.setTag('app_language', language);
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
 * 사용자에게는 조용하지만 우리는 알아야 할 때. 언제 쓰는지는 docs/observability.md.
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

/**
 * 가장 최근에 보낸 Sentry 이벤트 ID (#1162) — 버그 제보에 붙여 운영자가 Sentry 이슈로 바로
 * 건너가게 한다. 초기화 전·개발 빌드·실패면 undefined.
 */
export function lastErrorEventId(): string | undefined {
  try {
    return Sentry.lastEventId() || undefined;
  } catch {
    return undefined;
  }
}
