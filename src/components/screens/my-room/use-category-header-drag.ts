import { useRef, useState } from 'react';

import type { RoutineCategoryMeta } from '@/constants/routines';
import {
  type GroupSlot,
  mergeOrderedSubset,
  reorderedIds,
  resolveGroupDrop,
} from '@/components/screens/my-room/routine-drag';
import { useAnimatedValue, useLatestRef, useStableCallback } from '@/hooks/use-stable-value';
import { hapticSelection, hapticSuccess } from '@/utils/haptics';

/**
 * 나의 방 카테고리 헤더 롱프레스 드래그 (2026-09-08) — 화면에서 옮겼다(리팩토링 장부 14번,
 * 동작 그대로). `groupOrder`·`groupLayouts`는 화면이 렌더·onLayout에서 채우는 레지스트리라
 * 화면이 소유하고, 이 훅은 드래그 콜백에서 읽기만 한다.
 */
export function useCategoryHeaderDrag({
  categories,
  groupOrder,
  groupLayouts,
  onReorderCategories,
}: {
  categories: RoutineCategoryMeta[];
  /** 이번 렌더에 그려진 그룹의 카테고리 id — 렌더 순서. */
  groupOrder: string[];
  /** 그룹 컨테이너 onLayout 사각형 — 카테고리 id 키. */
  groupLayouts: Map<string, GroupSlot>;
  onReorderCategories?: (orderedIds: string[]) => void;
}) {
  // 헤더를 꾹 눌러 끌면 그룹(헤더+행)이 통째로 들려 손가락을 따라가고, 놓으면
  // onReorderCategories(전체 카테고리 id 순서)로 서버 sortOrder를 바꾼다. 미분류('')는
  // 항상 꼬리라 들 수 없고 그 아래로 떨어질 수도 없다(resolveGroupDrop이 세지 않음).
  // 행 드래그와는 배타 — 한쪽이 활성이면 다른 쪽 제스처는 enabled=false.
  const [catDragId, setCatDragId] = useState<string | null>(null);
  const catDragTY = useAnimatedValue(0);
  /** 드래그 시작 시점의 이동 가능(실제 카테고리) 그룹 순서 스냅샷. */
  const catOrderRef = useRef<string[]>([]);
  const catDropRef = useRef<number | null>(null);
  const catDragIdRef = useLatestRef(catDragId);
  const categoriesRef = useLatestRef(categories);

  const dispatchCatDragStart = useStableCallback((categoryId: string) => {
    hapticSelection();
    setCatDragId(categoryId);
    catDropRef.current = null;
    const live = new Set(categoriesRef.current.map((c) => c.id));
    catOrderRef.current = groupOrder.filter((id) => id !== '' && live.has(id));
  });
  const dispatchCatDragUpdate = useStableCallback((categoryId: string, translationY: number) => {
    catDropRef.current = resolveGroupDrop(
      groupLayouts,
      catOrderRef.current,
      categoryId,
      translationY,
    );
  });
  const dispatchCatDragEnd = useStableCallback((categoryId: string) => {
    const index = catDropRef.current;
    catDropRef.current = null;
    setCatDragId(null);
    catDragTY.setValue(0);
    if (index === null) return;
    const order = catOrderRef.current;
    const next = reorderedIds(order, categoryId, index);
    // 구분자는 이스케이프 `\0` — 위 endDrag의 주석 참고.
    if (next.join('\0') === order.join('\0')) return;
    hapticSuccess();
    // 달력 서버 날짜엔 일부 카테고리가 안 그려질 수 있다 — 전체 순서에 되섞어 보낸다.
    onReorderCategories?.(
      mergeOrderedSubset(
        categoriesRef.current.map((c) => c.id),
        next,
      ),
    );
  });
  const dispatchCatDragFinalize = useStableCallback((categoryId: string) => {
    if (catDragIdRef.current !== categoryId) return;
    setCatDragId(null);
    catDragTY.setValue(0);
  });

  return {
    catDragId,
    catDragTY,
    dispatchCatDragStart,
    dispatchCatDragUpdate,
    dispatchCatDragEnd,
    dispatchCatDragFinalize,
  };
}
