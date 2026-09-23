import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { onSessionCleared } from '@/api/auth';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { resetPreferencesSync, syncPreferences } from '@/lib/preferences-sync';

/**
 * 계정 언어·시간대 동기화 배선 (#1410) — 루트에서 한 번 켠다(`PreferencesSync`).
 *
 * - 로그인(세션 복원 포함) 직후와 앱 언어가 바뀔 때 `PATCH /me`.
 * - 앱이 foreground로 돌아올 때 기기 시간대를 다시 읽어 바뀌었으면 다시 보낸다(여행·설정 변경).
 * - 언어가 바뀌면 서버 캐시를 전부 무효화한다 — 카탈로그 이름·추천 문구가
 *   `Accept-Language`에 따라 달라지는데(`Vary: Accept-Language`) 쿼리 키에는 언어가 없다.
 *   드문 사건이라 전체 재조회가 키마다 언어를 넣는 것보다 싸다.
 */
export function usePreferencesSync(): void {
  const { status } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const seenLanguage = useRef(language);

  useEffect(() => onSessionCleared(resetPreferencesSync), []);

  useEffect(() => {
    if (status !== 'authed') return;
    void syncPreferences(language);
  }, [status, language]);

  useEffect(() => {
    if (seenLanguage.current === language) return;
    seenLanguage.current = language;
    void queryClient.invalidateQueries();
  }, [language, queryClient]);

  useEffect(() => {
    if (status !== 'authed') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncPreferences(language);
    });
    return () => sub.remove();
  }, [status, language]);
}
