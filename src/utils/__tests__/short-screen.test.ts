/**
 * 넓고 짧은 화면(접힌 아이폰 Duo 382×678, iPhone SE 375×667)에서는 폭에 맞춰 커지는 그림이
 * 세로를 다 먹는다. 그런 화면에서만 그림 높이를 화면 높이의 절반으로 줄인다 — 일반 폰은 그대로.
 */
import { isShortScreen, shortScreenHeroWidth } from '@/utils/short-screen';

const ROOM = 0.8333333333333334; // 방 계약 폭/높이

describe('isShortScreen', () => {
  test.each([
    ['기준 폰 402×874', 402, 874, false],
    ['Pixel 7 412×915', 412, 915, false],
    ['iPhone mini 375×812', 375, 812, false],
    ['접힌 Duo(인셋 뺀 폭) 382×678', 382, 678, true],
    ['iPhone SE 375×667', 375, 667, true],
  ])('%s → %s', (_name, width, height, expected) => {
    expect(isShortScreen(width, height)).toBe(expected);
  });
});

describe('shortScreenHeroWidth', () => {
  test('일반 폰은 줄이지 않는다(undefined)', () => {
    expect(shortScreenHeroWidth(402, 874, ROOM)).toBeUndefined();
  });

  test('접힌 Duo에서 방은 높이 339(화면 절반)에 맞춘 폭', () => {
    const width = shortScreenHeroWidth(382, 678, ROOM);
    expect(width).toBeCloseTo(339 * ROOM, 5);
    expect(width! / ROOM).toBeCloseTo(339, 5);
  });

  test('짧은 화면이라도 그림이 이미 절반보다 낮으면 줄이지 않는다', () => {
    // 폭 1.6 비율의 넓은 그림 — 382 폭이면 높이 239로 이미 절반(339) 아래.
    expect(shortScreenHeroWidth(382, 678, 1.6)).toBeUndefined();
  });
});
