/**
 * Public policy documents, hosted on GitHub Pages (TripleS-soma/policy).
 * The same URLs go into the store listings (App Privacy / Data safety).
 */
export const PolicyUrls = {
  terms: 'https://triples-soma.github.io/policy/terms.html',
  privacy: 'https://triples-soma.github.io/policy/privacy.html',
} as const;

export type PolicyDoc = keyof typeof PolicyUrls;

/** 도움말 '문의하기'가 여는 지원 메일 주소. */
export const SUPPORT_EMAIL = 'evan7484@gmail.com';
