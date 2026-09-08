import { type FurnitureItem, type PlacedFurniture, type Wallpaper } from '@/resources/furniture';

/**
 * 프리뷰 경제 (#501) — room-decor-screen에서 분리한 순수 계산.
 *
 * 프리뷰 = 미보유인데 배치/적용돼 있는 아이템. 별도 상태 없이 `owned`와의
 * 차집합으로 유도한다 — 구매 성공으로 ownedIds가 갱신되면 그 자리에서 자동으로
 * 정식 배치가 된다. 화면은 이 함수들을 `useMemo`로 감싸 호출만 한다.
 */

export type SurfaceKind = 'wallpaper' | 'floor' | 'background';

export const SURFACE_LABEL: Record<SurfaceKind, string> = {
  wallpaper: '벽지',
  floor: '바닥',
  background: '배경',
};

/** 적용 시점에 구매가 필요한 아이템 한 건. */
export type PreviewItem = { id: string; name: string; price: number };
export type SurfacePreview = PreviewItem & { kind: SurfaceKind };

/** 표면류 선택값 — 현재값과 진입 시점 값이 같은 모양. */
export type SurfaceSelection = {
  wallpaperId: string;
  floorId: string | null;
  backgroundId: string | null;
};

export type SurfaceCatalogs = {
  wallpapers: Wallpaper[];
  floors: Wallpaper[];
  backgrounds: Wallpaper[];
};

/** 저장 단위 — 가구 배치 + 표면류 3종 (null 표면 = 비움). */
export type LayoutValues = SurfaceSelection & { items: PlacedFurniture[] };

/**
 * 미보유 표면류 프리뷰. 진입 시점 값(서버 저장/시드)은 미보유여도 프리뷰가
 * 아니다 — 사용자가 고르지 않은 표면의 구매를 강요하지 않는다 (신규 계정
 * 기본 벽지 등).
 */
export function surfacePreviewsOf(
  owned: Set<string>,
  current: SurfaceSelection,
  initial: SurfaceSelection,
  catalogs: SurfaceCatalogs,
): SurfacePreview[] {
  const out: SurfacePreview[] = [];
  const push = (kind: SurfaceKind, id: string | null, init: string | null, arr: Wallpaper[]) => {
    if (!id || id === init || owned.has(id)) return;
    const it = arr.find((w) => w.id === id);
    if (it) out.push({ kind, id: it.id, name: it.name, price: it.price });
  };
  push('wallpaper', current.wallpaperId, initial.wallpaperId, catalogs.wallpapers);
  push('floor', current.floorId, initial.floorId, catalogs.floors);
  push('background', current.backgroundId, initial.backgroundId, catalogs.backgrounds);
  return out;
}

/** 방에 놓였지만 미보유인 가구 — 카탈로그에 없는 id는 건너뛴다. */
export function furniturePreviewsOf(
  items: PlacedFurniture[],
  owned: Set<string>,
  furniture: FurnitureItem[],
): PreviewItem[] {
  return items
    .filter((pl) => !owned.has(pl.furnitureId))
    .map((pl) => furniture.find((f) => f.id === pl.furnitureId))
    .filter((f): f is FurnitureItem => !!f)
    .map((f) => ({ id: f.id, name: f.name, price: f.price }));
}

/** 적용 시점에 구매가 필요한 프리뷰 전체 (가구 + 표면류). */
export function mergePendingPreviews(
  furniturePreviews: PreviewItem[],
  surfacePreviews: SurfacePreview[],
): PreviewItem[] {
  return [
    ...furniturePreviews,
    ...surfacePreviews.map(({ id, name, price }) => ({ id, name, price })),
  ];
}

/** 일괄 구매 합계 (다이아). */
export function previewTotalOf(previews: PreviewItem[]): number {
  return previews.reduce((sum, i) => sum + i.price, 0);
}

/** 프리뷰를 뺀 저장값 — 표면류는 진입 시점 값으로 복원한다. */
export function stripPreviews(
  values: LayoutValues,
  owned: Set<string>,
  initial: SurfaceSelection,
): LayoutValues {
  return {
    items: values.items.filter((pl) => owned.has(pl.furnitureId)),
    wallpaperId: owned.has(values.wallpaperId) ? values.wallpaperId : initial.wallpaperId,
    floorId: values.floorId && owned.has(values.floorId) ? values.floorId : initial.floorId,
    backgroundId:
      values.backgroundId && owned.has(values.backgroundId)
        ? values.backgroundId
        : initial.backgroundId,
  };
}
