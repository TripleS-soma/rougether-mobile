import { loadAsync } from 'expo-font';
import { useEffect } from 'react';

import { type BrandFontId, displayFaceFor, FONT_OPTIONS } from '@/constants/theme';

/**
 * Web (PWA) counterpart of the native config-plugin embed: registers the app
 * fonts (#382) under the same family names the native builds resolve
 * (PostScript names). Non-blocking — text falls back to the system font until
 * loading finishes.
 *
 * 선택한 폰트의 파일만 받는다(성능 장부 B4) — 12개(12.9MB)를 첫 접속에 전부 받던 것을
 * 줄인다. 폰트 설정 화면은 스와치용으로 각 폰트의 제목 얼굴 하나씩만 추가로 받는다.
 */
const FILES: Record<string, number> = {
  NanumSquareRoundR: require('@/assets/fonts/NanumSquareRoundR.ttf'),
  NanumSquareRoundB: require('@/assets/fonts/NanumSquareRoundB.ttf'),
  NanumSquareRoundEB: require('@/assets/fonts/NanumSquareRoundEB.ttf'),
  'Pretendard-Regular': require('@/assets/fonts/Pretendard-Regular.otf'),
  'Pretendard-Medium': require('@/assets/fonts/Pretendard-Medium.otf'),
  'Pretendard-SemiBold': require('@/assets/fonts/Pretendard-SemiBold.otf'),
  'Pretendard-Bold': require('@/assets/fonts/Pretendard-Bold.otf'),
  'Jua-Regular': require('@/assets/fonts/Jua-Regular.ttf'),
  'SUIT-Regular': require('@/assets/fonts/SUIT-Regular.otf'),
  'SUIT-Medium': require('@/assets/fonts/SUIT-Medium.otf'),
  'SUIT-SemiBold': require('@/assets/fonts/SUIT-SemiBold.otf'),
  'SUIT-Bold': require('@/assets/fonts/SUIT-Bold.otf'),
};

const PRETENDARD = [
  'Pretendard-Regular',
  'Pretendard-Medium',
  'Pretendard-SemiBold',
  'Pretendard-Bold',
];

/** 폰트 하나를 쓰는 데 필요한 패밀리 — 주아 혼합은 본문이 Pretendard라 함께 받는다. */
export const WEB_FONT_FAMILIES: Record<BrandFontId, readonly string[]> = {
  nanum: ['NanumSquareRoundR', 'NanumSquareRoundB', 'NanumSquareRoundEB'],
  pretendard: PRETENDARD,
  jua: ['Jua-Regular', ...PRETENDARD],
  suit: ['SUIT-Regular', 'SUIT-Medium', 'SUIT-SemiBold', 'SUIT-Bold'],
  system: [],
};

function load(families: readonly string[]) {
  const map = Object.fromEntries(
    families.filter((f) => FILES[f] != null).map((f) => [f, FILES[f]]),
  );
  if (Object.keys(map).length === 0) return;
  // 한 파일이 실패해도 시스템 폰트로 보일 뿐이다 — 앱 진입을 막지 않는다.
  void loadAsync(map).catch(() => {});
}

export function useWebFonts(fontId: BrandFontId): void {
  useEffect(() => load(WEB_FONT_FAMILIES[fontId]), [fontId]);
}

/** 폰트 설정 화면의 스와치 — 각 폰트의 제목 얼굴 하나씩. */
export function useWebFontPreviews(): void {
  useEffect(() => {
    load(
      FONT_OPTIONS.map((o) => displayFaceFor(o.id).fontFamily).filter(
        (f): f is string => typeof f === 'string',
      ),
    );
  }, []);
}
