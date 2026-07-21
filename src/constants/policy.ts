/**
 * Public policy documents, hosted on GitHub Pages (TripleS-soma/policy).
 * The same URLs go into the store listings (App Privacy / Data safety).
 */
export const PolicyUrls = {
  terms: 'https://triples-soma.github.io/policy/terms.html',
  privacy: 'https://triples-soma.github.io/policy/privacy.html',
} as const;

export type PolicyDoc = keyof typeof PolicyUrls;
