import { clamp01, lerp } from '@/utils/math';

describe('clamp01', () => {
  it('0~1 안의 값은 그대로 둔다', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(1)).toBe(1);
  });

  it('범위 밖은 가까운 끝으로 자른다', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-Infinity)).toBe(0);
    expect(clamp01(Infinity)).toBe(1);
  });
});

describe('lerp', () => {
  it('amount 0이면 from, 1이면 to, 0.5면 가운데', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('from > to(감소 방향)도 같은 식으로 보간한다', () => {
    expect(lerp(20, 10, 0.25)).toBe(17.5);
  });

  it('amount를 자르지 않는다 — 범위 밖은 외삽(필요하면 clamp01과 조합)', () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
    expect(lerp(0, 10, -0.5)).toBe(-5);
    expect(lerp(0, 10, clamp01(1.5))).toBe(10);
  });
});
