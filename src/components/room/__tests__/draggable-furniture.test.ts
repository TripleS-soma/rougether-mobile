import { hitSlopInset } from '@/components/room/draggable-furniture';

/**
 * 터치 영역 수축 (#768) — 가구 박스는 정사각형인데 아트는 그 안을 다 채우지
 * 않는다. 박스 전체가 터치를 먹으면 위 가구의 투명한 모서리가 아래 가구를
 * 가려, 눈에 보이는 것과 다른 물건이 잡힌다.
 */
describe('hitSlopInset (#768)', () => {
  /** 수축 후 남는 한 변. */
  const hitSize = (box: number) => box - hitSlopInset(box) * 2;

  it('넉넉한 박스는 78%로 줄인다', () => {
    // 360px 방 × baseWidth 0.28 ≈ 101px 박스.
    expect(hitSize(101)).toBeCloseTo(101 * 0.78, 5);
    expect(hitSize(200)).toBeCloseTo(156, 5);
  });

  it('작은 박스는 44pt 아래로 줄이지 않는다 — 소품을 못 집는 걸 막는다', () => {
    // 78%면 39px이 되는 크기. 하한이 없으면 최소 축척 소품이 안 잡힌다.
    expect(hitSize(50)).toBe(44);
    expect(hitSize(44)).toBe(44);
  });

  it('이미 44pt 이하인 박스는 아예 깎지 않는다', () => {
    expect(hitSlopInset(40)).toBe(0);
    expect(hitSlopInset(20)).toBe(0);
  });

  it('항상 0 이상 — 음수 인셋(=영역 확장)이 나오지 않는다', () => {
    for (const box of [0, 1, 44, 45, 56.4, 101, 353]) {
      expect(hitSlopInset(box)).toBeGreaterThanOrEqual(0);
    }
  });
});
