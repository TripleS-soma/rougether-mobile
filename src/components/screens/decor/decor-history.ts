import { useCallback, useReducer } from 'react';

import type { PlacedFurniture } from '@/resources/furniture';

/**
 * 방 꾸미기 실행 취소·다시 실행 (#1640) — 편집 문서 스냅샷 스택.
 *
 * **왜 명령(command) 패턴이 아니라 스냅샷인가**: 문서가 작고(가구 수십 개) 모든 편집이
 * 불변 갱신이라, 바뀌지 않은 가구 객체·배열은 스냅샷 사이에서 그대로 공유된다(구조 공유).
 * 명령마다 역연산을 따로 짜면 맨 앞/맨 뒤처럼 여러 가구의 z를 한꺼번에 바꾸는 동작에서
 * 되돌리기가 어긋날 여지가 생기지만, 스냅샷은 "그때 문서"로 돌아갈 뿐이라 틀릴 곳이 없다.
 *
 * **한 단계의 단위**: 드래그·핀치는 놓는 순간 한 번만 커밋되므로(제스처 중엔 UI 스레드의
 * 값만 움직인다, #608) 자연히 한 단계가 된다. 변화가 없는 커밋(선택 없이 툴바, 같은 벽지
 * 다시 고르기)은 쌓지 않는다 — 실행 취소를 눌렀는데 아무 일도 안 일어나는 단계가 생기지 않게.
 *
 * 선택 상태는 문서가 아니다 — 히스토리에 넣으면 "선택만 바꾼 단계"가 끼어 되돌리기가 헛돈다.
 */
export type DecorDoc = {
  items: PlacedFurniture[];
  wallpaperId: string;
  floorId: string | null;
  backgroundId: string | null;
};

/** 되돌릴 수 있는 최대 단계 — 그보다 오래된 단계는 버린다. */
export const DECOR_HISTORY_LIMIT = 50;

/**
 * 연속 입력 묶음 (#1642) — 방향키를 누르고 있으면 이동이 수십 번 커밋된다. 같은 키로
 * `DECOR_COALESCE_MS` 안에 이어 들어온 커밋은 새 단계를 만들지 않고 현재 단계를 덮어쓴다
 * (실행 취소 한 번에 그 연타 전체가 되돌아간다).
 */
export const DECOR_COALESCE_MS = 800;

export type DecorHistory = {
  past: DecorDoc[];
  present: DecorDoc;
  future: DecorDoc[];
  /** 마지막 묶음 커밋 — 다른 동작이 끼면 끊긴다. */
  group?: { key: string; at: number };
};

export type DecorHistoryAction =
  | {
      type: 'commit';
      update: (doc: DecorDoc) => DecorDoc;
      /** 연속 입력 묶음 키와 시각(ms) — 없으면 항상 새 단계. */
      group?: { key: string; at: number };
    }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; doc: DecorDoc };

const sameItem = (a: PlacedFurniture, b: PlacedFurniture) =>
  a === b ||
  (a.furnitureId === b.furnitureId &&
    a.x === b.x &&
    a.y === b.y &&
    a.z === b.z &&
    a.scale === b.scale &&
    a.rotationDeg === b.rotationDeg &&
    a.flipped === b.flipped);

/** 문서가 실제로 바뀌었는지 — 배열은 새로 만들어도 내용이 같으면 같은 문서다. */
export function sameDoc(a: DecorDoc, b: DecorDoc): boolean {
  if (a === b) return true;
  if (a.wallpaperId !== b.wallpaperId || a.floorId !== b.floorId) return false;
  if (a.backgroundId !== b.backgroundId) return false;
  if (a.items === b.items) return true;
  if (a.items.length !== b.items.length) return false;
  return a.items.every((item, i) => sameItem(item, b.items[i]));
}

export function decorHistoryReducer(state: DecorHistory, action: DecorHistoryAction): DecorHistory {
  switch (action.type) {
    case 'commit': {
      const next = action.update(state.present);
      if (sameDoc(next, state.present)) return state;
      const { group } = action;
      if (
        group &&
        state.group &&
        state.group.key === group.key &&
        group.at - state.group.at <= DECOR_COALESCE_MS &&
        state.past.length > 0
      ) {
        // 같은 연타의 이어짐 — 단계는 그대로, 현재 문서만 갱신.
        return { past: state.past, present: next, future: [], group };
      }
      const past = [...state.past, state.present];
      return {
        past:
          past.length > DECOR_HISTORY_LIMIT ? past.slice(past.length - DECOR_HISTORY_LIMIT) : past,
        present: next,
        future: [],
        group,
      };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { past: [...state.past, state.present], present: next, future: rest };
    }
    case 'reset':
      return { past: [], present: action.doc, future: [] };
  }
}

/** 화면이 쓰는 훅 — 반환 함수는 전부 참조 고정(#539, #794의 memo 경계를 뚫지 않게). */
export function useDecorHistory(initial: () => DecorDoc) {
  const [state, dispatch] = useReducer(decorHistoryReducer, undefined, () => ({
    past: [],
    present: initial(),
    future: [],
  }));
  const commit = useCallback(
    (update: (doc: DecorDoc) => DecorDoc, group?: { key: string; at: number }) =>
      dispatch({ type: 'commit', update, group }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const reset = useCallback((doc: DecorDoc) => dispatch({ type: 'reset', doc }), []);
  return {
    doc: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    commit,
    undo,
    redo,
    reset,
  };
}
