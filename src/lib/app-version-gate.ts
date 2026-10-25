import * as Updates from 'expo-updates';

/**
 * 구버전 설치본에 스토어 업데이트를 안내하는 게이트 (#1572).
 *
 * **왜 필요한가**: 네이티브 지문이 바뀌면 구 설치본은 OTA 레인에서 영구 이탈한다.
 * 승격을 몇 번 하든 `eas-release`를 몇 번 누르든 닿지 않는다(`release-channel.ts`의
 * `PRE_UGC_RUNTIMES`가 실제 사례다). 그 설치본에 말을 걸 유일한 수단이 이것이다.
 *
 * **왜 런타임 지문으로 판정하나**: 설치된 바이너리를 가리키는 값이어야 한다.
 * - `Constants.expoConfig.version`은 OTA로 들어온 번들의 app.json 값이다 — 1.5.4
 *   바이너리에 1.5.5 번들이 들어오면 1.5.5라고 답한다.
 * - `Constants.platform.ios.buildNumber`는 Info.plist의 `CFBundleVersion`이라 iOS에선
 *   맞지만, **Android의 `Constants.platform.android`는 SDK 55에서 빈 객체다**
 *   (`ConstantsService.kt`: `"platform" to mapOf("android" to emptyMap())`). 타입에만
 *   `versionCode: number`가 남아 있고 값이 오지 않는다 — Android에서 영영 안 뜬다.
 * - `expo-application`은 네이티브 모듈이라 추가하는 순간 지문이 바뀌고, 그러면 이
 *   기능이 지금 설치본에 OTA로 못 간다.
 *
 * 남는 건 `Updates.runtimeVersion`이다. 바이너리마다 박혀 있고 OTA로 바뀌지 않으며
 * (바뀌면 그 OTA가 애초에 그 설치본에 안 온다) 두 플랫폼에서 똑같이 동작한다.
 *
 * **왜 "오래된 것"을 나열하나**: "최신 지문만 적고 그 밖은 전부 구버전"으로 뒤집으면
 * 새 빌드의 지문을 적는 걸 잊었을 때 **최신 사용자에게 업데이트하라고 조른다.** 나열
 * 방식은 잊었을 때 아무 일도 일어나지 않는다. 안전한 쪽으로 틀리게 둔다.
 */
export const APP_VERSION_GATE_URL = 'https://rougether.com/app-version.json';

export type VersionGateConfig = {
  /** 안내 문구에 보여 줄 사람이 읽는 버전("1.5.4"). 미루기 기억의 단위이기도 하다. */
  latestVersion?: string;
  /** 안내할 런타임 지문 — 닫을 수 있는 시트. */
  staleRuntimes: readonly string[];
  /** 막을 런타임 지문 — 서버 계약이 실제로 깨진 바이너리에만. */
  blockedRuntimes: readonly string[];
};

export type VersionGateLevel = 'ok' | 'recommended' | 'blocked';

export type VersionGateVerdict = {
  level: VersionGateLevel;
  /** 안내에 띄울 최신 버전 — 원격에 없으면 undefined(문구에서 생략). */
  latestVersion?: string;
};

const VERDICT_OK: VersionGateVerdict = { level: 'ok' };

const EMPTY: VersionGateConfig = { staleRuntimes: [], blockedRuntimes: [] };

/** 지문 꼴(40자리 hex)만 받는다 — 오타·빈 문자열이 목록에 섞여도 무해하게 버린다. */
function toRuntimeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (value): value is string => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value),
  );
}

/** 원격 JSON → 설정. 형식이 어긋난 항목은 조용히 버린다(게이트가 덜 동작할 뿐). */
export function parseVersionGate(raw: unknown): VersionGateConfig {
  if (raw == null || typeof raw !== 'object') return EMPTY;
  const value = raw as Record<string, unknown>;
  return {
    latestVersion: typeof value.latestVersion === 'string' ? value.latestVersion : undefined,
    staleRuntimes: toRuntimeList(value.staleRuntimes),
    blockedRuntimes: toRuntimeList(value.blockedRuntimes),
  };
}

/**
 * 설치된 바이너리의 런타임 지문. 없으면 undefined — 웹·개발 빌드·Expo Go가 그렇고,
 * 그 경우 게이트는 아무것도 하지 않는다.
 */
export function installedRuntime(): string | undefined {
  const runtime = Updates.runtimeVersion;
  return typeof runtime === 'string' && runtime.length > 0 ? runtime : undefined;
}

/**
 * 판정. **모르면 통과시킨다** — 설정이 없거나 지문을 못 읽으면 'ok'다. 안내를 못 하는
 * 것보다 쓰던 앱을 못 쓰게 만드는 쪽이 나쁘다.
 */
export function decideVersionGate(
  config: VersionGateConfig | undefined,
  runtime: string | undefined,
): VersionGateVerdict {
  if (!config || runtime == null) return VERDICT_OK;
  if (config.blockedRuntimes.includes(runtime))
    return { level: 'blocked', latestVersion: config.latestVersion };
  if (config.staleRuntimes.includes(runtime))
    return { level: 'recommended', latestVersion: config.latestVersion };
  return VERDICT_OK;
}

/**
 * 원격 설정 조회. 캐시를 쓰지 않는다 — 목록을 고친 직후에도 바로 반영되어야 하고,
 * 랜딩은 GitHub Pages라 CDN 캐시가 붙는다.
 *
 * **조회 실패를 예외로 올리지 않는다.** 올리면 react-query 실패 경로를 타고 Sentry로
 * 가는데(`shouldReportQueryError`는 `ApiError`·네트워크 예외 외 전부 보고한다), 랜딩이
 * 잠깐 404·5xx를 내는 동안 설치본 수만큼 이벤트가 쌓여 월 한도를 노이즈로 채운다.
 * `docs/observability.md`의 "4xx·오프라인은 보내지 않는다"와 같은 취지다. 어차피 이
 * 게이트는 "모르면 통과"라 빈 설정과 조회 실패의 결과가 같다.
 *
 * 응답을 해석하는 `parseVersionGate`는 try 밖에 둔다 — 그쪽에서 나는 예외는 환경이
 * 아니라 코드 버그이므로 삼키지 않는다.
 */
export async function fetchVersionGate(signal?: AbortSignal): Promise<VersionGateConfig> {
  let payload: unknown;
  try {
    const response = await fetch(`${APP_VERSION_GATE_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      signal,
    });
    if (!response.ok) return EMPTY;
    payload = await response.json();
  } catch {
    return EMPTY;
  }
  return parseVersionGate(payload);
}
