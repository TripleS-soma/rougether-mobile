import { i18n } from '@/i18n';

/**
 * 공개 정책 문서 — rougether.com (#809). 랜딩과 한 사이트로 통합됐다.
 * 스토어 등록정보(개인정보처리방침 URL·데이터 보안)에도 같은 주소가 들어간다.
 *
 * 구 주소(`…github.io/policy/*.html`)는 리다이렉트 스텁으로 살려 뒀다 —
 * 이미 스토어에 나간 빌드가 그 주소를 열기 때문에 지우면 앱 내 약관이 죽는다.
 */
export const PolicyUrls = {
  terms: 'https://rougether.com/terms.html',
  privacy: 'https://rougether.com/privacy.html',
} as const;

/** 영어판 (#1369) — 랜딩 `public/en/{terms,privacy}.html`. 한국어가 원문이며 그 외 언어는 영어판. */
export const PolicyUrlsEn = {
  terms: 'https://rougether.com/en/terms.html',
  privacy: 'https://rougether.com/en/privacy.html',
} as const;

export type PolicyDoc = keyof typeof PolicyUrls;

/** 앱 언어에 맞는 정책 문서 주소 — 순수 함수(화면·테스트용). */
export function policyUrlFor(doc: PolicyDoc, language: string): string {
  return language === 'ko' ? PolicyUrls[doc] : PolicyUrlsEn[doc];
}

/** 현재 앱 언어(i18n)의 정책 문서 주소 — 훅 밖(갤러리·유틸)에서. */
export function policyUrl(doc: PolicyDoc): string {
  return policyUrlFor(doc, i18n.language ?? 'ko');
}

/** 도움말 '문의하기'가 여는 지원 메일 주소. */
export const SUPPORT_EMAIL = 'evan7484@gmail.com';
