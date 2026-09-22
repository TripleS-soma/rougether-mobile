import { usePreferencesSync } from '@/hooks/use-preferences-sync';

/**
 * 계정 언어·시간대를 서버와 맞추는 무화면 컴포넌트 (#1410). `AuthProvider`·`LanguageProvider`·
 * `QueryClientProvider` 안쪽, 루트 레이아웃에 한 번만 둔다.
 */
export function PreferencesSync() {
  usePreferencesSync();
  return null;
}
