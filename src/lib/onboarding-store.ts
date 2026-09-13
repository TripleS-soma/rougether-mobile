import AsyncStorage from '@react-native-async-storage/async-storage';

import { type CharacterId } from '@/constants/characters';

/**
 * 예전 기기 단위 키 — 계정 구분이 없었다. 같은 기기에서 계정을 바꿔 가입하거나, 안드로이드
 * 자동 백업으로 앞 설치의 데이터가 복원되면 **새 계정이 "온보딩 끝남"으로 보여** 목표 설문·
 * 추천 루틴·튜토리얼 미션을 통째로 건너뛰었다(2026-09-11 제보). 이제는 계정별 키에 쓰고,
 * 이 키는 주인이 확인될 때만 읽어서 옮긴다(app-root 참고).
 */
export const LEGACY_ONBOARDING_KEY = 'rougether.onboarding.v1';
const keyFor = (userId: number) => `${LEGACY_ONBOARDING_KEY}.${userId}`;

export type OnboardingData = { characterId: CharacterId; goals: string[] };

/** `legacy`면 기기 단위 옛 키에서 읽은 값 — 이 계정 것인지 호출부가 판정해야 한다. */
export type StoredOnboarding = { data: OnboardingData; legacy: boolean };

async function read(key: string): Promise<OnboardingData | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as OnboardingData) : null;
  } catch {
    return null;
  }
}

/**
 * First-launch onboarding result (chosen character + goals), persisted locally
 * so the flow only shows once. The server (GET /onboarding) is the source of
 * truth; this is the cache/fallback. 계정을 모르면(`userId` 없음) 옛 기기 키만 쓴다.
 */
export async function loadOnboarding(userId?: number): Promise<StoredOnboarding | null> {
  if (userId != null) {
    const own = await read(keyFor(userId));
    if (own) return { data: own, legacy: false };
  }
  const legacy = await read(LEGACY_ONBOARDING_KEY);
  return legacy ? { data: legacy, legacy: userId != null } : null;
}

export async function saveOnboarding(data: OnboardingData, userId?: number): Promise<void> {
  try {
    await AsyncStorage.setItem(
      userId != null ? keyFor(userId) : LEGACY_ONBOARDING_KEY,
      JSON.stringify(data),
    );
  } catch {
    // Ignore persistence failures — the app still works this session.
  }
}

/** 옛 기기 키가 이 계정 것으로 확인됐을 때 — 계정별 키로 옮기고 옛 키를 지운다. */
export async function claimLegacyOnboarding(userId: number, data: OnboardingData): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(data));
    await AsyncStorage.removeItem(LEGACY_ONBOARDING_KEY);
  } catch {
    // ignore — 다음 실행에 같은 판정을 다시 한다.
  }
}

/**
 * 튜토리얼 다시 보기 초기화 — 이 계정 기록만 지운다. 옛 기기 키는 주인이 확인되기 전까지
 * 다른 계정 것일 수 있어 건드리지 않는다(#1299 리뷰): 서버 completed=false인 옛 사용자에게는
 * 그 기록이 유일한 완료 신호다. 계정을 모를 때만 옛 키를 지운다.
 */
export async function resetOnboarding(userId?: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(userId != null ? keyFor(userId) : LEGACY_ONBOARDING_KEY);
  } catch {
    // ignore
  }
}
