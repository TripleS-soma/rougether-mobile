import { createInstance } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import en from '@/i18n/resources/en.json';
import ko from '@/i18n/resources/ko.json';

/**
 * 앱 문구 i18n (#893). 한국어가 원문이자 폴백이고, 영어는 같은 키 집합을 반드시 갖는다
 * (`src/i18n/__tests__/i18n-keys.test.ts`가 강제). 화면은 `useT()`로 문구를 얻는다 —
 * 이 모듈을 거쳐야 i18next 초기화가 보장된다. 언어 선택·영속화는 `use-language`.
 */
export const SUPPORTED_LANGUAGES = ['ko', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AppLanguage = 'ko';

/** 언어 선택 화면의 표기 — 각 언어의 자기 이름으로(번역하지 않는다). */
export const LANGUAGE_OPTIONS: readonly { id: AppLanguage; name: string }[] = [
  { id: 'ko', name: '한국어' },
  { id: 'en', name: 'English' },
];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return SUPPORTED_LANGUAGES.some((lng) => lng === value);
}

export const resources = {
  ko: { translation: ko },
  en: { translation: en },
} as const;

// 전역 싱글턴 대신 앱 전용 인스턴스 — 라이브러리 기본 인스턴스와 섞이지 않는다.
export const i18n = createInstance();
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    // 값에 HTML이 없고 RN Text에 그대로 들어가므로 이스케이프하지 않는다.
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

/** 화면용 번역 함수 — `const tr = useT(); tr('settings.title')`. 언어가 바뀌면 리렌더된다. */
export function useT() {
  return useTranslation().t;
}
