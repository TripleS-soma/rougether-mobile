import { createInstance } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import enCommon from '@/i18n/resources/en/common.json';
import enMember from '@/i18n/resources/en/member.json';
import enRoutineTodo from '@/i18n/resources/en/routineTodo.json';
import enHouse from '@/i18n/resources/en/house.json';
import enRoomShop from '@/i18n/resources/en/roomShop.json';
import enNotification from '@/i18n/resources/en/notification.json';
import enApp from '@/i18n/resources/en/app.json';
import enSettings from '@/i18n/resources/en/settings.json';
import enMinigame from '@/i18n/resources/en/minigame.json';
import koCommon from '@/i18n/resources/ko/common.json';
import koMember from '@/i18n/resources/ko/member.json';
import koRoutineTodo from '@/i18n/resources/ko/routineTodo.json';
import koHouse from '@/i18n/resources/ko/house.json';
import koRoomShop from '@/i18n/resources/ko/roomShop.json';
import koNotification from '@/i18n/resources/ko/notification.json';
import koApp from '@/i18n/resources/ko/app.json';
import koSettings from '@/i18n/resources/ko/settings.json';
import koMinigame from '@/i18n/resources/ko/minigame.json';

/**
 * 앱 문구 i18n (#893). 한국어가 원문이자 폴백이고, 영어는 같은 키 집합을 반드시 갖는다
 * (`src/i18n/__tests__/i18n-keys.test.ts`가 강제). 화면은 `useT()`로 문구를 얻는다 —
 * 이 모듈을 거쳐야 i18next 초기화가 보장된다. 언어 선택·영속화는 `use-language`.
 */
export const SUPPORTED_LANGUAGES = ['ko', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AppLanguage = 'ko';

/**
 * 설정 > 언어 노출 (#893 2단계 게이트, 2026-09-14) — 도메인 전환이 끝나기 전엔 English가
 * 반쪽(설정·공통만 영어)이라 프로덕션에 행을 보이지 않는다. 전환 완료 시 true로.
 */
export const LANGUAGE_PICKER_ENABLED = true;

/** 언어 선택 화면의 표기 — 각 언어의 자기 이름으로(번역하지 않는다). */
export const LANGUAGE_OPTIONS: readonly { id: AppLanguage; name: string }[] = [
  { id: 'ko', name: '한국어' },
  { id: 'en', name: 'English' },
];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return SUPPORTED_LANGUAGES.some((lng) => lng === value);
}

/**
 * 리소스는 도메인별 파일 (#893 2단계) — 여러 PR이 같은 파일을 만져 충돌하지 않게.
 * 새 도메인은 `resources/{ko,en}/<domain>.json`을 만들고 아래 두 목록에 같이 넣는다.
 * 각 파일의 최상위 키는 그 도메인 접두(예: `member`, `routineTodo`)로 서로 겹치지 않아야 한다.
 */
export const koResources = {
  ...koCommon,
  ...koSettings,
  ...koMember,
  ...koRoutineTodo,
  ...koHouse,
  ...koRoomShop,
  ...koNotification,
  ...koApp,
  ...koMinigame,
};
export const enResources = {
  ...enCommon,
  ...enSettings,
  ...enMember,
  ...enRoutineTodo,
  ...enHouse,
  ...enRoomShop,
  ...enNotification,
  ...enApp,
  ...enMinigame,
};

export const resources = {
  ko: { translation: koResources },
  en: { translation: enResources },
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
