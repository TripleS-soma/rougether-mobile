import type { AppLanguage } from '@/i18n';

/**
 * 요청 표시 언어 (#1410, 서버 #396) — 모든 API 요청에 `Accept-Language`로 실린다. 서버는 이
 * 값으로 카탈로그 이름·추천 문구를 번역해 돌려주고, 계정 설정(`users.language`)은 건드리지
 * 않는다(그건 `PATCH /me`). `LanguageProvider`가 언어를 정할 때마다 갱신한다.
 *
 * i18next 인스턴스를 직접 읽지 않고 따로 두는 이유: API 계층이 i18n 초기화(리소스 로드)에
 * 묶이지 않게, 그리고 헤드리스 작업(위젯 동기화·백그라운드)이 같은 값을 쓰게.
 */
let current: AppLanguage = 'ko';

export function getRequestLanguage(): AppLanguage {
  return current;
}

export function setRequestLanguage(language: AppLanguage): void {
  current = language;
}
