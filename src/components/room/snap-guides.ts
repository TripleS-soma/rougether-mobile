import type { PlacedFurniture } from '@/resources/furniture';

/**
 * 방 꾸미기 스마트 가이드·스냅 (#1644) — 드래그 중 다른 가구의 중심선·방 가운데 세로선에
 * 가까워지면 그 선에 붙인다. 계산은 팬 워클릿 안(UI 스레드)에서 매 프레임 돈다 — 드래그 중엔
 * React 상태를 건드리지 않는다는 규칙(#608)을 그대로 지키기 위해서다.
 */

/** 이만큼(px) 안으로 들어오면 붙는다 — 손가락 떨림보다 크고, 의도한 미세 위치를 빼앗지 않는 선. */
export const SNAP_THRESHOLD_PX = 6;
/** 가이드 없음 — 공유 값의 "선 숨김" 표시. */
export const NO_GUIDE = -1;

/** 정규화(0~1) 좌표의 스냅 후보 — x는 세로 가이드, y는 가로 가이드. */
export type SnapTargets = { xs: number[]; ys: number[] };

/**
 * 한 축 스냅 — 가장 가까운 후보가 `thresholdPx` 안이고 그 축의 이동 가능 범위([minPx, maxPx])
 * 안이면 그 후보의 px 좌표, 아니면 `NO_GUIDE`. 범위 밖 후보에 붙으면 손을 뗄 때 클램프가
 * 되돌려 "붙었다 튕기는" 모습이 되므로 아예 후보에서 뺀다.
 */
export function snapAxis(
  valuePx: number,
  targets: readonly number[],
  sizePx: number,
  thresholdPx: number,
  minPx: number,
  maxPx: number,
): number {
  'worklet';
  let best = NO_GUIDE;
  let bestDistance = thresholdPx;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i] * sizePx;
    if (t < minPx || t > maxPx) continue;
    const d = Math.abs(valuePx - t);
    if (d <= bestDistance) {
      best = t;
      bestDistance = d;
    }
  }
  return best;
}

/** 선택된 가구의 스냅 후보 — 방 가운데 세로선 + 다른 가구들의 중심 (자기 자신 제외). */
export function snapTargetsFor(items: readonly PlacedFurniture[], selectedId: string): SnapTargets {
  const others = items.filter((p) => p.furnitureId !== selectedId);
  return { xs: [0.5, ...others.map((p) => p.x)], ys: others.map((p) => p.y) };
}
