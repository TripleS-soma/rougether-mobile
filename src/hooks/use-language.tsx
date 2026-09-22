import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getLocales } from 'expo-localization';

import { setRequestLanguage } from '@/api/request-language';
import { type AppLanguage, DEFAULT_LANGUAGE, i18n, isAppLanguage } from '@/i18n';
import { setAnalyticsLanguage } from '@/lib/analytics';
import { setErrorLanguage } from '@/lib/error-reporting';
import { loadLanguage, saveLanguage } from '@/lib/language-store';

/**
 * 기기 언어 (#893 3단계) — 저장된 선택이 없을 때만 쓴다. 지원 언어(ko/en)면 그대로,
 * 그 외(ja, zh …)는 영어로 — 한국어보다 영어가 더 넓은 폴백이다.
 */
export function detectDeviceLanguage(): AppLanguage {
  try {
    const code = getLocales()[0]?.languageCode ?? null;
    if (isAppLanguage(code)) return code;
    return code ? 'en' : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * 앱 언어 프로바이더 (#893) — 저장된 언어가 있으면 그것을, 없으면 기기 언어(expo-localization)를
 * i18next에 적용하고, 바꾸면 즉시 반영·영속화한다. BrandThemeProvider와 나란히 루트에 둔다.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(
    (i18n.resolvedLanguage as AppLanguage | undefined) ?? DEFAULT_LANGUAGE,
  );
  useEffect(() => {
    let alive = true;
    void loadLanguage().then((stored) => {
      if (!alive) return;
      // 저장된 선택 > 기기 언어. 기기 언어로 정했을 땐 저장하지 않는다 — 기기 설정을 바꾸면 따라가게.
      const next = stored ?? detectDeviceLanguage();
      if (next === i18n.language) return;
      void i18n.changeLanguage(next);
      setLanguageState(next);
    });
    return () => {
      alive = false;
    };
  }, []);
  // 계측 차원 (#1369)과 요청 헤더 언어 (#1410) — 초기 결정(저장값/기기 언어)과 변경 둘 다
  // 여기서 한 번에 잡힌다.
  useEffect(() => {
    setAnalyticsLanguage(language);
    setErrorLanguage(language);
    setRequestLanguage(language);
  }, [language]);
  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    void i18n.changeLanguage(next);
    void saveLanguage(next);
  }, []);
  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** 현재 언어와 setter. 프로바이더 밖(단독 테스트·갤러리)에서는 기본 언어에 no-op setter. */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  return ctx ?? { language: DEFAULT_LANGUAGE, setLanguage: () => {} };
}
