import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * 나의 방 루틴 수동 순서 (#716) — 카테고리별 루틴 id 순서를 기기에 보관한다.
 * 서버에 routine sortOrder 필드가 없어(카테고리에는 있음) 로컬 우선으로
 * 시작한다 (집 자리 배치 #278과 같은 결). 서버 필드가 생기면 이관(#717).
 *
 * 저장 형태: `{ [categoryId]: [routineId, ...] }`. 미분류 그룹은 빈 문자열 키.
 * 목록에 없는 id는 무시되고, 새 루틴은 순서 맵에 없으므로 기존 정렬 뒤에
 * 붙는다(applyRoutineOrder 참조).
 */
const STORAGE_KEY = 'rougether.routine-order';

export type RoutineOrder = Record<string, string[]>;

export function useRoutineOrder() {
  const [order, setOrder] = useState<RoutineOrder>({});

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as RoutineOrder;
        if (saved && typeof saved === 'object') setOrder(saved);
      } catch {
        // 손상된 저장값은 무시 — 서버 순서로 폴백.
      }
    });
  }, []);

  /** 한 카테고리의 루틴 순서를 갱신하고 기기에 저장한다. */
  const reorder = useCallback((categoryId: string, orderedIds: string[]) => {
    setOrder((prev) => {
      const next = { ...prev, [categoryId]: orderedIds };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { order, reorder };
}

/**
 * 저장된 수동 순서를 항목 배열에 적용한다 (#716). 맵에 있는 id가 그 순서대로
 * 먼저 오고, 맵에 없는 항목(새로 만든 루틴 등)은 원래 순서를 유지한 채 뒤에
 * 붙는다. 순수 함수라 화면·테스트가 공유한다.
 */
export function applyRoutineOrder<T extends { id: string }>(
  items: T[],
  orderedIds: string[] | undefined,
): T[] {
  if (!orderedIds || orderedIds.length === 0) return items;
  const rank = new Map(orderedIds.map((id, i) => [id, i]));
  const known = items.filter((it) => rank.has(it.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!); // prettier-ignore
  const rest = items.filter((it) => !rank.has(it.id));
  return [...known, ...rest];
}
