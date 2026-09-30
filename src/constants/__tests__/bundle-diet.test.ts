/**
 * 번들 다이어트 잠금 (성능 장부 나 묶음) — 프로덕션 번들에서 빼는 모듈의 판정과
 * 웹 폰트 선택 로드 표를 고정한다. 실제 크기 효과는 PR 본문의 expo export 실측.
 */
import { FONT_OPTIONS } from '@/constants/theme';

// metro.config.js가 쓰는 판정 함수 — 설정 파일 자체는 Sentry metro 등을 끌어와 jest에서 못 연다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { stripFromProduction } = require('@/stubs/strip-from-production') as {
  stripFromProduction: (ctx: { dev: boolean }, name: string, platform: string | null) => boolean;
};

describe('프로덕션 번들 제외 판정 (src/stubs/strip-from-production.js)', () => {
  const prod = { dev: false };
  const dev = { dev: true };

  it('Dev 갤러리(@/dev/*)는 프로덕션에서만 뺀다 (B5)', () => {
    expect(stripFromProduction(prod, '@/dev/gallery', 'ios')).toBe(true);
    expect(stripFromProduction(prod, '@/dev/navigation-preview', 'android')).toBe(true);
    expect(stripFromProduction(dev, '@/dev/gallery', 'ios')).toBe(false);
  });

  it('Material Symbols 폰트는 Android 프로덕션에서만 뺀다 (B3)', () => {
    const font = '@expo-google-fonts/material-symbols/600SemiBold';
    expect(stripFromProduction(prod, font, 'android')).toBe(true);
    expect(stripFromProduction(prod, font, 'ios')).toBe(false);
    expect(stripFromProduction(dev, font, 'android')).toBe(false);
  });

  it('앱 코드는 건드리지 않는다', () => {
    expect(stripFromProduction(prod, '@/components/ui/button', 'android')).toBe(false);
    expect(stripFromProduction(prod, 'react-native', 'ios')).toBe(false);
  });
});

describe('웹 폰트는 선택한 폰트만 받는다 (B4)', () => {
  // 웹 변형을 직접 불러 표를 본다(네이티브 변형은 no-op).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WEB_FONT_FAMILIES } = require('@/hooks/use-web-fonts.web') as {
    WEB_FONT_FAMILIES: Record<string, readonly string[]>;
  };

  it('모든 폰트 선택지에 항목이 있고, 시스템 폰트는 받을 게 없다', () => {
    for (const { id } of FONT_OPTIONS) expect(WEB_FONT_FAMILIES[id]).toBeDefined();
    expect(WEB_FONT_FAMILIES.system).toEqual([]);
  });

  it('주아 혼합은 본문용 Pretendard를 함께 받는다', () => {
    expect(WEB_FONT_FAMILIES.jua).toEqual(
      expect.arrayContaining(['Jua-Regular', 'Pretendard-Regular']),
    );
  });
});
