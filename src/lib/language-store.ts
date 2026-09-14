import AsyncStorage from '@react-native-async-storage/async-storage';

import { type AppLanguage, isAppLanguage } from '@/i18n';

/**
 * 앱 언어 (#893) — 기기 설정이라 계정과 무관한 기기 단위 키. `rougether.` 접두는
 * 탈퇴 시 `wipeLocalAppData`가 함께 지운다(기본 언어로 돌아감).
 */
const KEY = 'rougether.language.v1';

export async function loadLanguage(): Promise<AppLanguage | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return isAppLanguage(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function saveLanguage(language: AppLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, language);
  } catch {
    // 저장 실패가 언어 전환 자체를 막지 않는다 — 다음 실행에 기본으로 돌아갈 뿐.
  }
}
