import {
  NO_GUIDE,
  SNAP_THRESHOLD_PX,
  snapAxis,
  snapTargetsFor,
} from '@/components/room/snap-guides';

describe('snapAxis (#1644)', () => {
  // 320px 폭 방, 후보는 정규화 좌표.
  const W = 320;

  it('임계(6px) 안이면 가장 가까운 후보 px로 붙는다', () => {
    expect(snapAxis(158, [0.5, 0.65], W, SNAP_THRESHOLD_PX, 0, W)).toBe(160);
    expect(snapAxis(205, [0.5, 0.65], W, SNAP_THRESHOLD_PX, 0, W)).toBe(208);
    // 두 후보가 다 가까우면 더 가까운 쪽.
    expect(snapAxis(161, [0.5, 0.51], W, SNAP_THRESHOLD_PX, 0, W)).toBe(160);
  });

  it('임계 밖이면 붙지 않는다', () => {
    expect(snapAxis(150, [0.5], W, SNAP_THRESHOLD_PX, 0, W)).toBe(NO_GUIDE);
    expect(snapAxis(100, [], W, SNAP_THRESHOLD_PX, 0, W)).toBe(NO_GUIDE);
  });

  it('이동 가능 범위 밖 후보는 버린다 — 붙었다가 놓을 때 클램프로 튕기지 않게', () => {
    expect(snapAxis(298, [0.95], W, SNAP_THRESHOLD_PX, 0, 300)).toBe(NO_GUIDE);
  });
});

describe('snapTargetsFor', () => {
  it('방 가운데 세로선 + 자기 자신을 뺀 다른 가구들의 중심', () => {
    const items = [
      { furnitureId: 'bed', x: 0.3, y: 0.7, z: 1 },
      { furnitureId: 'rug', x: 0.65, y: 0.8, z: 2 },
      { furnitureId: 'plant', x: 0.2, y: 0.4, z: 3 },
    ];
    expect(snapTargetsFor(items, 'bed')).toEqual({ xs: [0.5, 0.65, 0.2], ys: [0.8, 0.4] });
  });
});
