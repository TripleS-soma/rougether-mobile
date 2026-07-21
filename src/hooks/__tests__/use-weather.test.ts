import { isRainCode } from '@/hooks/use-weather';

describe('isRainCode (#360)', () => {
  it('이슬비/비/소나기/뇌우는 비, 맑음·흐림·눈은 비 아님', () => {
    expect(isRainCode(0)).toBe(false); // 맑음
    expect(isRainCode(2)).toBe(false); // 구름
    expect(isRainCode(45)).toBe(false); // 안개
    expect(isRainCode(51)).toBe(true); // 이슬비
    expect(isRainCode(63)).toBe(true); // 비
    expect(isRainCode(67)).toBe(true); // 어는 비
    expect(isRainCode(71)).toBe(false); // 눈 — 비만 반영
    expect(isRainCode(80)).toBe(true); // 소나기
    expect(isRainCode(95)).toBe(true); // 뇌우
  });
});
