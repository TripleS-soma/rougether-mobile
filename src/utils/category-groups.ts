import { UNCATEGORIZED_META, type RoutineCategoryMeta } from '@/constants/routines';

export type CategoryGroup<T> = { meta: RoutineCategoryMeta; items: T[] };

/**
 * 카테고리별 묶음 (리팩토링 장부 26번) — 루틴 관리와 친구 방이 같은 규칙을 각자 구현하고
 * 있었다(한쪽은 `Set`, 다른 쪽은 배열 `includes`). 규칙:
 * - 카테고리 순서대로, 항목이 있는 묶음만.
 * - 카테고리가 없거나 목록에 없는 카테고리의 항목(삭제 UNASSIGN 산물 #517, 비공개)은
 *   마지막 '미분류' 묶음 하나로 — 다른 카테고리에 섞지 않는다.
 */
export function groupByCategory<T extends { category?: string }>(
  items: readonly T[],
  categories: readonly RoutineCategoryMeta[],
): CategoryGroup<T>[] {
  const groups = categories
    .map((meta) => ({ meta, items: items.filter((item) => item.category === meta.id) }))
    .filter((group) => group.items.length > 0);
  const known = new Set(categories.map((c) => c.id));
  const rest = items.filter((item) => !item.category || !known.has(item.category));
  if (rest.length > 0) groups.push({ meta: UNCATEGORIZED_META, items: rest });
  return groups;
}
