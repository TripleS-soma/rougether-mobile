import { getCalendars } from 'expo-localization';

import { updatePreferences } from '@/api/me';
import type { MemberPreferencesRequest } from '@/api/types';
import type { AppLanguage } from '@/i18n';

/**
 * 계정 언어·시간대 동기화 (#1410, 서버 #396, spec `global-localization.md`).
 *
 * 서버는 저장된 `users.language`로 푸시·주간 회고를 쓰고, `users.time_zone`으로 개인
 * 리마인드·저녁 미완료·고양이 복귀 알림의 현지 시각을 정한다. 기기 시간대 변경을 서버가
 * 추정하지 않으므로 앱이 보내야 한다. 공동 미션·출석·보상 날짜는 계속 KST — 이 동기화는
 * 앱의 `todayIso`(Asia/Seoul) 정책과 무관하다.
 *
 * 전송 규칙: 프로세스 안에서 마지막으로 성공한 값과 같으면 보내지 않는다. 세션이 지워지면
 * (`resetPreferencesSync`) 다음 로그인에 다시 보낸다. 실패는 조용히 — 다음 foreground에서
 * 재시도한다.
 */
type Preferences = { language: AppLanguage; timeZone: string | null };

let lastSent: Preferences | null = null;
let chain: Promise<unknown> = Promise.resolve();

/** 서버가 받는 IANA ID 모양(`Area/City`, `UTC`). 고정 오프셋(`+09:00`)·빈 값은 400이라 거른다. */
const IANA_PATTERN = /^(UTC|[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+)$/;

export function isIanaTimeZone(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && IANA_PATTERN.test(value);
}

/**
 * 기기(OS) 시간대 — expo-localization의 달력 정보에서, 없으면 JS `Intl`에서. 둘 다 못 읽으면
 * null(그러면 시간대는 보내지 않고 언어만 보낸다 — 서버는 기존 값을 유지한다).
 */
export function detectDeviceTimeZone(): string | null {
  try {
    const fromDevice = getCalendars()[0]?.timeZone;
    if (isIanaTimeZone(fromDevice)) return fromDevice;
  } catch {
    // 네이티브 모듈 부재(테스트·구형 웹) — 아래 Intl로.
  }
  try {
    const fromIntl = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isIanaTimeZone(fromIntl)) return fromIntl;
  } catch {
    // Intl 미지원 환경.
  }
  return null;
}

function same(a: Preferences | null, b: Preferences): boolean {
  return a != null && a.language === b.language && a.timeZone === b.timeZone;
}

/**
 * 지금 값(앱 언어 + 기기 시간대)을 서버에 보낸다. 마지막 성공값과 같으면 건너뛴다.
 * 동시 호출(언어 변경 + foreground)은 직렬화해 순서대로 한 번씩만 판단한다.
 * 실제로 보냈으면 true.
 */
export function syncPreferences(language: AppLanguage): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    const next: Preferences = { language, timeZone: detectDeviceTimeZone() };
    if (same(lastSent, next)) return false;
    const body: MemberPreferencesRequest = { language };
    if (next.timeZone) body.timeZone = next.timeZone;
    try {
      await updatePreferences(body);
      lastSent = next;
      return true;
    } catch {
      return false;
    }
  };
  const result = chain.then(run, run);
  chain = result;
  return result;
}

/** 세션이 지워졌을 때 — 다음 로그인(다른 계정일 수 있음)에 다시 보내게. */
export function resetPreferencesSync(): void {
  lastSent = null;
}

/** 테스트용. */
export function __lastSentPreferencesForTests(): Preferences | null {
  return lastSent;
}
