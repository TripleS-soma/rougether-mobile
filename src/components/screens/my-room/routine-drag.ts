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

// --- 카테고리 그룹 롱프레스 드래그 (2026-09-08) ---
// 그룹 헤더를 꾹 눌러 끌면 그 카테고리(안의 루틴·투두 포함)가 통째로 움직인다.
// 행 드래그(window 좌표 + 손가락 절대 y)와 달리 그룹은 부모 기준 onLayout 사각형과
// 팬 translationY만으로 계산한다 — 그룹 컨테이너는 같은 부모 안에 있어 상대 좌표가
// 서로 비교 가능하고, 측정 콜백(비동기)을 리프트 시점에 기다릴 필요가 없다.

/** 그룹 컨테이너의 onLayout 사각형 — 부모(리스트 섹션) 기준. */
export type GroupSlot = { y: number; height: number };

/**
 * 끌고 있는 그룹의 새 index (#716 확장). 들린 그룹의 중심(레이아웃 중심 + translationY)
 * 보다 위에 중심이 있는 **다른** 그룹의 개수가 곧 삽입 위치다 — resolveDrop의 행
 * 규칙과 같다. `order`는 드래그 대상이 될 수 있는 그룹 id만(미분류·삭제된 카테고리
 * 제외) 렌더 순서대로; 그 밖의 그룹은 아예 세지 않으므로 미분류 아래로는 떨어질 수
 * 없다. 들린 그룹의 레이아웃이 없으면(측정 전) null.
 */
export function resolveGroupDrop(
  layouts: ReadonlyMap<string, GroupSlot>,
  order: readonly string[],
  draggedId: string,
  translationY: number,
): number | null {
  const me = layouts.get(draggedId);
  if (!me) return null;
  const center = me.y + me.height / 2 + translationY;
  let index = 0;
  for (const id of order) {
    if (id === draggedId) continue;
    const slot = layouts.get(id);
    if (slot && center > slot.y + slot.height / 2) index += 1;
  }
  return index;
}

/**
 * 부분 순서를 전체 순서에 되섞는다. 달력 서버 날짜에는 일부 카테고리(그 날 항목이
 * 없고 퀵애드도 막힌 것)가 안 그려지는데, 서버 저장은 전체 카테고리 순서를 요구한다
 * (reorderCategories는 개수가 다르면 무시). 보이는 카테고리끼리만 자리를 바꾸고
 * 안 보이는 카테고리는 원래 자리를 지킨다 — `full`에 없는 id는 버린다.
 */
export function mergeOrderedSubset(full: readonly string[], subsetOrdered: readonly string[]) {
  const inFull = new Set(full);
  const queue = subsetOrdered.filter((id) => inFull.has(id));
  const moving = new Set(queue);
  let k = 0;
  return full.map((id) => (moving.has(id) ? queue[k++] : id));
}
