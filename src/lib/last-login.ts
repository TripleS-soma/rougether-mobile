import AsyncStorage from '@react-native-async-storage/async-storage';

/** 소셜 로그인 프로바이더 — 최근 로그인 배지의 대상. */
export type SocialProvider = 'kakao' | 'apple' | 'google';

const KEY = 'rougether.last-login-provider.v1';
const PROVIDERS: SocialProvider[] = ['kakao', 'apple', 'google'];

/**
 * 마지막으로 성공한 소셜 로그인 프로바이더 (#489 후속). 로그인 화면이
 * "최근 로그인" 배지를 어느 버튼에 붙일지 정하는 데 쓴다. 재로그인 안내가
 * 목적이므로 **로그아웃 때 지우지 않는다** — 새 로그인 성공이 덮어쓸 뿐.
 */
export async function loadLastLoginProvider(): Promise<SocialProvider | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return PROVIDERS.includes(raw as SocialProvider) ? (raw as SocialProvider) : null;
  } catch {
    return null;
  }
}

/** Fire-and-forget — 저장 실패는 배지가 안 뜰 뿐이라 조용히 무시한다. */
export function saveLastLoginProvider(provider: SocialProvider): void {
  AsyncStorage.setItem(KEY, provider).catch(() => {});
}
