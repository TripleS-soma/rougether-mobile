import { i18n } from '@/i18n';
import {
  PolicyUrls,
  PolicyUrlsEn,
  isFriendBioPublic,
  policyUrl,
  policyUrlFor,
} from '@/constants/policy';

/** 정책 문서 주소는 앱 언어를 따른다 (#1369) — 한국어 원문, 그 외는 영어판. */
describe('policy urls (#1369)', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('한국어는 기존 주소, 영어는 /en/ 문서', () => {
    expect(policyUrlFor('terms', 'ko')).toBe(PolicyUrls.terms);
    expect(policyUrlFor('privacy', 'ko')).toBe(PolicyUrls.privacy);
    expect(policyUrlFor('terms', 'en')).toBe(PolicyUrlsEn.terms);
    expect(policyUrlFor('privacy', 'en')).toBe('https://rougether.com/en/privacy.html');
  });

  it('현재 i18n 언어를 따른다', async () => {
    expect(policyUrl('terms')).toBe(PolicyUrls.terms);
    await i18n.changeLanguage('en');
    expect(policyUrl('terms')).toBe(PolicyUrlsEn.terms);
  });
});

// 한 줄 소개 공개는 방침 2.1 시행일(KST 10/21)부터 — 7일 고지를 약속했다.
describe('isFriendBioPublic', () => {
  it('hides housemate intros before the policy takes effect', () => {
    expect(isFriendBioPublic('2026-10-20')).toBe(false);
    expect(isFriendBioPublic('2026-10-21')).toBe(true);
    expect(isFriendBioPublic('2026-11-01')).toBe(true);
  });
});
