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

export type PolicyDoc = keyof typeof PolicyUrls;

/** 도움말 '문의하기'가 여는 지원 메일 주소. */
export const SUPPORT_EMAIL = 'evan7484@gmail.com';
