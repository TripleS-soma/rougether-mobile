// 나의 방 루틴 롱프레스 재정렬(#716)의 순수 로직 — 측정된 행 위치와 손가락
// 좌표로 드롭 대상을 계산한다. 제스처·애니메이션 배선은 컴포넌트가 갖고,
// 여기엔 좌표 수학만 둔다(집 카메라/좌석 드래그 #693과 같은 분리).

/** 드래그 가능한(미완료) 행의 측정 사각형 — window 좌표, 시각 순서대로. */
export type DragSlot = {
  routineId: string;
  categoryId: string;
  top: number;
  bottom: number;
};

/** 드롭 결과 — 대상 카테고리와 그 카테고리 미완료 리스트 내 삽입 index. */
export type DropTarget = { categoryId: string; index: number };

/**
 * 손가락 y(window)가 가리키는 드롭 대상 (#716). 대상 카테고리는 손가락이
 * 걸친 행의 카테고리(경계 밖이면 가장 가까운 행)로 정하고, index는 그
 * 카테고리 미완료 슬롯 중 손가락 중심보다 위에 있는 개수다. 드래그 중인
 * 행 자신은 순서 계산에서 제외해, 제자리 드롭이 no-op이 되게 한다.
 */
export function resolveDrop(slots: DragSlot[], fingerY: number, draggedId: string): DropTarget {
  if (slots.length === 0) return { categoryId: '', index: 0 };

  // 1) 손가락이 걸친 행 → 없으면 가장 가까운 행으로 대상 카테고리 결정.
  let hovered = slots.find((s) => fingerY >= s.top && fingerY <= s.bottom);
  if (!hovered) {
    hovered = slots.reduce((best, s) => {
      const d = fingerY < s.top ? s.top - fingerY : fingerY - s.bottom;
      const bestD = fingerY < best.top ? best.top - fingerY : fingerY - best.bottom;
      return d < bestD ? s : best;
    });
  }
  const categoryId = hovered.categoryId;

  // 2) 대상 카테고리의 슬롯(드래그 중인 자신 제외) 중 손가락 중심보다 위 개수.
  const inCat = slots.filter((s) => s.categoryId === categoryId && s.routineId !== draggedId);
  let index = 0;
  for (const s of inCat) {
    const mid = (s.top + s.bottom) / 2;
    if (fingerY > mid) index += 1;
  }
  return { categoryId, index };
}

/**
 * 이 드롭을 거절해야 하나 (#716, PR #718 리뷰). 실제 카테고리가 있는데
 * '미분류'(id '')로의 **타 카테고리 이동**은 막는다 — 서버 categoryId를 빈
 * 값으로 unset할 수 없어(PUT에서 필드가 빠짐) 화면만 옮겨지고 reload 시
 * 되돌아간다. 퀵애드가 미분류를 막는 것(canQuickAdd)과 같은 제약. 미분류
 * 안에서의 순서 변경(from도 '')은 로컬 전용이라 허용.
 */
export function isRejectedDrop(
  target: DropTarget,
  fromCategoryId: string,
  hasRealCategories: boolean,
): boolean {
  return hasRealCategories && target.categoryId === '' && fromCategoryId !== '';
}

/**
 * 재정렬 후 카테고리의 새 id 순서 (#716) — 미완료 id 배열에서 draggedId를
 * 빼고 index 위치에 다시 끼운다. 같은 카테고리 내 이동·타 카테고리 진입 공용
 * (진입 시 baseIds에 draggedId가 없으면 그냥 index에 삽입).
 */
export function reorderedIds(baseIds: string[], draggedId: string, index: number): string[] {
  const without = baseIds.filter((id) => id !== draggedId);
  const clamped = Math.max(0, Math.min(index, without.length));
  return [...without.slice(0, clamped), draggedId, ...without.slice(clamped)];
}
