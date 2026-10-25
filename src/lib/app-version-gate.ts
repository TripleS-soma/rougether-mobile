import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 구버전 설치본에 스토어 업데이트를 안내하는 게이트 (#1572).
 *
 * **왜 필요한가**: 네이티브 지문이 바뀌면 구 설치본은 OTA 레인에서 영구 이탈한다.
 * 승격을 몇 번 하든 `eas-release`를 몇 번 누르든 닿지 않는다(`release-channel.ts`의
 * `PRE_UGC_RUNTIMES`가 실제 사례다). 그 설치본에 말을 걸 유일한 수단이 이것이다.
 *
 * **왜 버전 문자열이 아니라 빌드 번호인가**: `Constants.expoConfig.version`은 OTA로
 * 들어온 JS 번들의 app.json 값이다 — 1.5.4 바이너리에 1.5.5 번들이 OTA로 들어오면
 * 1.5.5라고 답한다. 설치된 바이너리를 가리키지 못한다. 빌드 번호(iOS
 * `CFBundleVersion` · Android `versionCode`)는 바이너리에 박혀 있어 OTA로 안 바뀐다.
 *
 * **왜 `expo-application`이 아닌가**: 네이티브 모듈이라 추가하는 순간 지문이 바뀌고,
 * 그러면 이 기능이 지금 설치본에 OTA로 못 간다. `expo-constants`는 이미 들어 있다.
 * `Constants.platform.*`는 deprecated 표시가 붙었지만 SDK 55에서 동작하며, 못 읽으면
 * 게이트가 **조용히 통과**하므로 최악의 결과가 "아무 일도 안 일어남"이다.
 */
export const APP_VERSION_GATE_URL = 'https://rougether.com/app-version.json';

export type VersionGateRule = {
  /** 이 번호보다 낮으면 앱을 막는다. 0이면 끔. */
  minimumBuild: number;
  /** 이 번호보다 낮으면 닫을 수 있는 안내만 띄운다. 0이면 끔. */
  recommendedBuild: number;
  /** 안내 문구에 보여 줄 사람이 읽는 버전("1.5.4"). 판정에는 쓰지 않는다. */
  latestVersion?: string;
};

export type VersionGateConfig = {
  ios?: VersionGateRule;
  android?: VersionGateRule;
};

export type VersionGateLevel = 'ok' | 'recommended' | 'blocked';

export type VersionGateVerdict = {
  level: VersionGateLevel;
  /** 안내에 띄울 최신 버전 — 원격에 없으면 undefined(문구에서 생략). */
  latestVersion?: string;
  /** 'recommended'를 미룬 기억의 단위 — 이 번호가 올라가면 다시 안내한다. */
  recommendedBuild?: number;
};

const VERDICT_OK: VersionGateVerdict = { level: 'ok' };

function toRule(raw: unknown): VersionGateRule | undefined {
  if (raw == null || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const minimum = value.minimumBuild;
  const recommended = value.recommendedBuild;
  if (!Number.isInteger(minimum) || !Number.isInteger(recommended)) return undefined;
  const min = minimum as number;
  const rec = recommended as number;
  if (min < 0 || rec < 0) return undefined;
  const latestVersion = typeof value.latestVersion === 'string' ? value.latestVersion : undefined;
  // 뒤집힌 값(막는 기준이 권하는 기준보다 높음)은 사람이 잘못 적은 것이다 —
  // 막는 쪽을 버린다. 안내를 놓치는 건 복구되지만 멀쩡한 설치본을 막는 건 아니다.
  if (min > rec) return { minimumBuild: 0, recommendedBuild: rec, latestVersion };
  return { minimumBuild: min, recommendedBuild: rec, latestVersion };
}

/** 원격 JSON → 설정. 형식이 조금이라도 어긋나면 그 플랫폼 규칙을 버린다. */
export function parseVersionGate(raw: unknown): VersionGateConfig {
  if (raw == null || typeof raw !== 'object') return {};
  const value = raw as Record<string, unknown>;
  return { ios: toRule(value.ios), android: toRule(value.android) };
}

/**
 * 설치된 바이너리의 빌드 번호. 읽을 수 없으면 undefined — 웹·Expo Go·개발 빌드가
 * 그렇고, 그 경우 게이트는 아무것도 하지 않는다.
 */
export function installedBuildNumber(os: string = Platform.OS): number | undefined {
  const raw =
    os === 'ios'
      ? Constants.platform?.ios?.buildNumber
      : os === 'android'
        ? Constants.platform?.android?.versionCode
        : undefined;
  if (raw == null) return undefined;
  const parsed = Number(raw);
  // 0·음수·NaN·소수는 바이너리 번호가 아니다. 판정 근거로 쓰지 않는다.
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * 판정. **모르면 통과시킨다** — 규칙이 없거나 설치본 번호를 못 읽으면 'ok'다.
 * 안내를 못 하는 것보다 쓰던 앱을 못 쓰게 만드는 쪽이 나쁘다.
 */
export function decideVersionGate(
  rule: VersionGateRule | undefined,
  installedBuild: number | undefined,
): VersionGateVerdict {
  if (!rule || installedBuild == null) return VERDICT_OK;
  if (rule.minimumBuild > 0 && installedBuild < rule.minimumBuild)
    return { level: 'blocked', latestVersion: rule.latestVersion };
  if (rule.recommendedBuild > 0 && installedBuild < rule.recommendedBuild)
    return {
      level: 'recommended',
      latestVersion: rule.latestVersion,
      recommendedBuild: rule.recommendedBuild,
    };
  return VERDICT_OK;
}

/** 이 플랫폼에 해당하는 규칙. */
export function ruleForPlatform(
  config: VersionGateConfig | undefined,
  os: string = Platform.OS,
): VersionGateRule | undefined {
  if (!config) return undefined;
  if (os === 'ios') return config.ios;
  if (os === 'android') return config.android;
  return undefined;
}

/**
 * 원격 설정 조회. 캐시를 쓰지 않는다 — 번호를 올린 직후에도 바로 반영되어야
 * 하고, 랜딩은 GitHub Pages라 CDN 캐시가 붙는다.
 */
export async function fetchVersionGate(signal?: AbortSignal): Promise<VersionGateConfig> {
  const response = await fetch(`${APP_VERSION_GATE_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error(`version gate ${response.status}`);
  return parseVersionGate(await response.json());
}
