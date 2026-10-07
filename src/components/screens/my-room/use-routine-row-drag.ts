import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';

import {
  type DragSlot,
  type DropTarget,
  isRejectedDrop,
  reorderedIds,
  resolveDrop,
} from '@/components/screens/my-room/routine-drag';
import { useAnimatedValue, useLatestRef, useStableCallback } from '@/hooks/use-stable-value';
import { hapticSelection, hapticSuccess } from '@/utils/haptics';

/**
 * 행 핸들러 레지스트리의 모양 — 화면이 렌더 중에 비우고 다시 채운다(#769·#1207). 이 훅은
 * 콜백 안에서 **읽기만** 한다(렌더 중 쓰기는 화면에 남긴다 — 장부 '건드리지 말 것').
 */
export type RowRegistry = Map<
  string,
  { spec: { routineId: string; draggable?: boolean }; categoryId?: string }
>;

/**
 * 나의 방 루틴/투두 롱프레스 재정렬 (#716) — 화면에서 옮겼다(리팩토링 장부 14번, 동작 그대로).
 * 행에 넘기는 디스패처는 참조 고정(useStableCallback)이라 memo 경계를 깨지 않는다.
 */
export function useRoutineRowDrag({
  rowHandlers,
  hasRealCategories,
  onReorderRoutines,
  onMoveRoutineCategory,
}: {
  rowHandlers: RowRegistry;
  /** 실제 카테고리가 있으면 '미분류'로의 이동은 서버 반영이 안 돼 스냅백(#718). */
  hasRealCategories: boolean;
  onReorderRoutines?: (categoryId: string, orderedIds: string[]) => void;
  onMoveRoutineCategory?: (routineId: string, categoryId: string) => void;
}) {
  // 미완료 행만 대상. 롱프레스로 들어 손가락을 따라가고, 놓으면 같은 카테고리면
  // 순서 변경(로컬), 다른 카테고리 그룹 위면 영구 이동(서버). 완료 행은 하단으로
  // 가라앉은 상태라 드래그에서 제외한다. 방 탭뿐 아니라 달력 탭의 모든 날짜에서도
  // 같은 의미다 (2026-09-08) — 서버 날짜의 행은 레지스트리의 routineId로 그 루틴
  // 자체를 옮기고, 순서는 카테고리 전역 순서(routineOrder)에 쓴다.
  const [dragId, setDragId] = useState<string | null>(null);
  const dragTY = useAnimatedValue(0);
  const rowRefs = useRef(new Map<string, View>());
  const dragSlotsRef = useRef<DragSlot[]>([]);
  const dropRef = useRef<DropTarget | null>(null);
  // 드래그 시작 시점의 카테고리별 미완료 id 순서 스냅샷 — 드롭 계산의 기준.
  const baseOrderRef = useRef<Map<string, string[]>>(new Map());

  // 인자는 행 키 (#1207) — dragId는 `active` 비교용이라 행 키 공간에 둔다.
  const beginDrag = useCallback(
    (rowKey: string) => {
      hapticSelection();
      setDragId(rowKey);
      // 기준 순서는 **지금 그려진 리스트**(방 탭 오늘 / 달력 오늘 / 달력 서버 날짜)의
      // 드래그 가능한 행 — 레지스트리는 렌더 순서대로 채워지므로 그대로 읽는다.
      // 카테고리 id는 그룹의 것(서버 날짜면 기록 당시 카테고리).
      const base = new Map<string, string[]>();
      const catById = new Map<string, string>();
      rowHandlers.forEach(({ spec, categoryId }) => {
        if (!spec.draggable || categoryId === undefined) return;
        base.set(categoryId, [...(base.get(categoryId) ?? []), spec.routineId]);
        catById.set(spec.routineId, categoryId);
      });
      baseOrderRef.current = base;
      // window 좌표 측정은 비동기 — 다음 프레임 안에 채워져 onUpdate가 쓴다
      // (집 좌석 드래그 #278와 같은 리프트 시점 측정).
      dragSlotsRef.current = [];
      rowRefs.current.forEach((node, key) => {
        // ref 맵은 행 키로 등록된다 — 슬롯은 루틴 id 공간이라 레지스트리로 되찾는다.
        const routineId = rowHandlers.get(key)?.spec.routineId;
        if (!routineId) return;
        node.measureInWindow((x, y, w, h) => {
          dragSlotsRef.current.push({
            routineId,
            categoryId: catById.get(routineId) ?? '',
            top: y,
            bottom: y + h,
          });
        });
      });
    },
    [rowHandlers],
  );

  const updateDrop = useCallback((draggedId: string, absoluteY: number) => {
    dropRef.current = resolveDrop(dragSlotsRef.current, absoluteY, draggedId);
  }, []);

  const endDrag = useCallback(
    (draggedId: string, fromCategoryId: string) => {
      const target = dropRef.current;
      dropRef.current = null;
      setDragId(null);
      dragTY.setValue(0);
      if (!target) return;
      // 실제 카테고리가 있을 때 '미분류'로의 이동은 서버 반영이 안 돼(#718
      // 리뷰) 스냅백 — 미분류 내 순서 변경은 아래 same-category 분기로 허용.
      if (isRejectedDrop(target, fromCategoryId, hasRealCategories)) return;
      const destBase = baseOrderRef.current.get(target.categoryId) ?? [];
      if (target.categoryId === fromCategoryId) {
        const next = reorderedIds(destBase, draggedId, target.index);
        // 구분자는 반드시 이스케이프 `\0`로 — 예전엔 리터럴 NUL 문자를 그대로
        // 박아 넣어서, grep·ripgrep이 이 파일을 바이너리로 보고 **1600줄 전체가
        // 검색에서 사라졌다**. 동작은 같지만 도구에 보이는지가 다르다.
        if (next.join('\0') !== destBase.join('\0')) {
          hapticSuccess();
          onReorderRoutines?.(fromCategoryId, next);
        }
        return;
      }
      // 다른 카테고리 = 영구 이동(서버) + 양쪽 로컬 순서 갱신.
      hapticSuccess();
      onMoveRoutineCategory?.(draggedId, target.categoryId);
      onReorderRoutines?.(target.categoryId, reorderedIds(destBase, draggedId, target.index));
      const fromNext = (baseOrderRef.current.get(fromCategoryId) ?? []).filter(
        (id) => id !== draggedId,
      );
      onReorderRoutines?.(fromCategoryId, fromNext);
    },
    [dragTY, onReorderRoutines, onMoveRoutineCategory, hasRealCategories],
  );

  const registerRowRef = useCallback((rowKey: string, node: View | null) => {
    if (node) rowRefs.current.set(rowKey, node);
    else rowRefs.current.delete(rowKey);
  }, []);

  const dragIdRef = useLatestRef(dragId);
  /** 행 키 → 서버 루틴 id. 드래그 콜백은 행 키로 오지만 재정렬·이동은 루틴 id로 나간다. */
  const routineIdOf = (rowKey: string) => rowHandlers.get(rowKey)?.spec.routineId;
  const dispatchDragStart = useStableCallback((rowKey: string) => beginDrag(rowKey));
  const dispatchDragUpdate = useStableCallback((rowKey: string, absoluteY: number) => {
    const routineId = routineIdOf(rowKey);
    if (routineId !== undefined) updateDrop(routineId, absoluteY);
  });
  const dispatchDragEnd = useStableCallback((rowKey: string) => {
    const entry = rowHandlers.get(rowKey);
    if (entry?.categoryId !== undefined) endDrag(entry.spec.routineId, entry.categoryId);
  });
  const dispatchDragFinalize = useStableCallback((rowKey: string) => {
    if (dragIdRef.current !== rowKey) return;
    setDragId(null);
    dragTY.setValue(0);
  });

  return {
    dragId,
    dragTY,
    registerRowRef,
    dispatchDragStart,
    dispatchDragUpdate,
    dispatchDragEnd,
    dispatchDragFinalize,
  };
}
