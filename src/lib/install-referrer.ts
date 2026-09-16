import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { track } from '@/lib/analytics';
import { type ParsedInvite, parseInstallReferrer } from '@/lib/invite-code';

/**
 * 설치 후 첫 실행에 Play Install Referrer로 초대코드를 되찾는다 (#1007 네이티브 절반).
 *
 * 미설치 사용자가 초대 링크를 누르면 서버 랜딩이 Play 스토어 링크에 referrer를 실어
 * 보내고(`invite_type=friend&invite_code=CODE`), 설치된 앱은 그 값을 Install Referrer
 * API로 딱 한 번 읽어 기존 pending 초대 채널(`pending-invite.ts`)에 맡긴다. 그 뒤는
 * 링크로 들어온 코드와 똑같이 — 미리보기 확인 시트를 거쳐야 쓴다. **자동 redeem 없음.**
 *
 * ## 설치 단위로 1회
 *
 * referrer는 계정이 아니라 **설치**에 붙은 값이다(Play가 설치 후 90일 보관). 그래서 읽음
 * 표시도 설치 단위 키 하나로 둔다 — 계정별로 두면 같은 기기에서 계정을 바꿀 때마다 같은
 * 초대가 다시 떠서, 초대한 사람 하나로 여러 계정이 보상을 노리는 길이 된다. 탈퇴
 * (`wipeLocalAppData`, `rougether.` 접두)가 이 키도 지우지만, 다시 뜬 코드는 서버
 * 미리보기(`alreadyRedeemed`·자기 코드·무효)가 한 번 더 거른다.
 *
 * ## 언제 읽지 않나
 *
 * - Android가 아니거나(iOS는 클립보드 봉투 경로) 네이티브 모듈이 없는 빌드(웹·구 바이너리).
 * - 이미 읽었으면(기기 플래그). Play 서비스가 일시적으로 없을 때만 플래그를 남기지 않아
 *   다음 실행에 다시 시도한다.
 */

const READ_KEY = 'rougether.install-referrer.read.v1';

type ReferrerModule = { getInstallReferrer(): Promise<string | null> };

function native(): ReferrerModule | null {
  if (Platform.OS !== 'android') return null;
  return requireOptionalNativeModule<ReferrerModule>('RougetherInstallReferrer');
}

export type InstallReferrerResult =
  | { kind: 'invite'; invite: ParsedInvite }
  /** 읽긴 했지만 초대가 아니다(유기적 설치·다른 캠페인) — 다시 읽지 않는다. */
  | { kind: 'none' }
  /** 이번 실행에서 읽지 않았다 — 지원 안 함·이미 읽음·일시 오류. */
  | { kind: 'skipped' };

let inFlight: Promise<InstallReferrerResult> | null = null;

/**
 * 설치 referrer를 1회 읽어 초대코드를 돌려준다. 채널 주입은 호출측(셸)이 한다 — 이미
 * 링크로 들어온 코드를 덮지 않도록 호출측이 먼저 살핀다. 같은 실행에서 여러 번 불려도
 * 네이티브 호출은 한 번.
 */
export function readInstallReferrerInvite(): Promise<InstallReferrerResult> {
  if (!inFlight) inFlight = read();
  return inFlight;
}

async function read(): Promise<InstallReferrerResult> {
  const module = native();
  if (!module) return { kind: 'skipped' };
  try {
    if ((await AsyncStorage.getItem(READ_KEY)) != null) return { kind: 'skipped' };
  } catch {
    // 플래그를 못 읽으면 매번 읽게 되지만, 코드는 미리보기가 거르므로 해롭지 않다.
  }
  let raw: string | null;
  try {
    raw = await module.getInstallReferrer();
  } catch {
    // Play 서비스 일시 오류 — 플래그를 남기지 않는다. 다음 실행에 다시.
    return { kind: 'skipped' };
  }
  void AsyncStorage.setItem(READ_KEY, new Date().toISOString()).catch(() => {});
  const invite = parseInstallReferrer(raw);
  // 퍼널 분모 — 설치당 1회. 코드 자체는 보내지 않는다.
  track('invite_referrer_result', { kind: invite ? invite.kind : 'none' });
  return invite ? { kind: 'invite', invite } : { kind: 'none' };
}

/** 테스트 전용 — 실행당 1회 캐시를 비운다. */
export function resetInstallReferrerForTests() {
  inFlight = null;
}
