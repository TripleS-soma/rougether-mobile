import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { type AppLanguage, DEFAULT_LANGUAGE, i18n } from '@/i18n';
import { loadLanguage, saveLanguage } from '@/lib/language-store';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * 앱 언어 프로바이더 (#893) — 저장된 언어를 읽어 i18next에 적용하고, 바꾸면 즉시
 * 반영·영속화한다. BrandThemeProvider와 나란히 루트에 둔다. 기기 언어 자동 감지
 * (expo-localization)는 네이티브 모듈이라 다음 네이티브 윈도우에 붙인다.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(
    (i18n.resolvedLanguage as AppLanguage | undefined) ?? DEFAULT_LANGUAGE,
  );
  useEffect(() => {
    let alive = true;
    void loadLanguage().then((stored) => {
      if (!alive || !stored || stored === i18n.language) return;
      void i18n.changeLanguage(stored);
      setLanguageState(stored);
    });
    return () => {
      alive = false;
    };
  }, []);
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
