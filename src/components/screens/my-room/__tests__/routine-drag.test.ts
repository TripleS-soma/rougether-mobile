import {
  type DragSlot,
  type GroupSlot,
  isRejectedDrop,
  mergeOrderedSubset,
  reorderedIds,
  resolveDrop,
  resolveGroupDrop,
} from '@/components/screens/my-room/routine-drag';

// 세 행: 운동(a,b) 40~120, 공부(c) 140~180. 각 행 높이 40, 간격 20.
const SLOTS: DragSlot[] = [
  { routineId: 'a', categoryId: 'ex', top: 40, bottom: 80 },
  { routineId: 'b', categoryId: 'ex', top: 80, bottom: 120 },
  { routineId: 'c', categoryId: 'st', top: 140, bottom: 180 },
];

describe('resolveDrop (#716)', () => {
  it('같은 카테고리 위쪽에 놓으면 index 0 (자신 제외)', () => {
    // a를 b 위 절반보다 위(y=85, b의 중심 100보다 위)로 → ex의 0번.
    expect(resolveDrop(SLOTS, 85, 'a')).toEqual({ categoryId: 'ex', index: 0 });
  });

  it('같은 카테고리에서 아래 행 중심을 넘기면 그 아래로', () => {
    // a를 b 중심(100) 아래(y=110)로 → b 다음, ex index 1.
    expect(resolveDrop(SLOTS, 110, 'a')).toEqual({ categoryId: 'ex', index: 1 });
  });

  it('다른 카테고리 행 위에 놓으면 그 카테고리로 이동', () => {
    // a를 공부(c) 위(y=150)로 → st 카테고리, c 중심(160) 위라 index 0.
    expect(resolveDrop(SLOTS, 150, 'a')).toEqual({ categoryId: 'st', index: 0 });
  });

  it('마지막 행 아래로 끌면 그 카테고리 끝에 붙는다', () => {
    // a를 c 아래(y=200)로 → st, c 중심 아래라 index 1.
    expect(resolveDrop(SLOTS, 200, 'a')).toEqual({ categoryId: 'st', index: 1 });
  });

  it('맨 위 밖(y<모든 행)은 가장 가까운 행의 카테고리 맨 앞', () => {
    expect(resolveDrop(SLOTS, 0, 'c')).toEqual({ categoryId: 'ex', index: 0 });
  });

  it('빈 슬롯이면 안전하게 미분류 0', () => {
    expect(resolveDrop([], 100, 'a')).toEqual({ categoryId: '', index: 0 });
  });
});

describe('reorderedIds (#716)', () => {
  it('같은 카테고리 내 위치 이동', () => {
    expect(reorderedIds(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(reorderedIds(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
  });

  it('제자리 드롭은 그대로 (no-op)', () => {
    expect(reorderedIds(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
  });

  it('다른 카테고리 진입 — baseIds에 없으면 index에 삽입', () => {
    expect(reorderedIds(['x', 'y'], 'a', 1)).toEqual(['x', 'a', 'y']);
  });

  it('index가 범위를 벗어나도 clamp된다', () => {
    expect(reorderedIds(['a', 'b'], 'c', 99)).toEqual(['a', 'b', 'c']);
  });
});

describe('isRejectedDrop (#716, PR #718 리뷰)', () => {
  it('실제 카테고리가 있을 때 미분류로의 타 카테고리 이동은 거절', () => {
    expect(isRejectedDrop({ categoryId: '', index: 0 }, 'ex', true)).toBe(true);
  });

  it('미분류 안에서의 순서 변경(from도 미분류)은 허용', () => {
    expect(isRejectedDrop({ categoryId: '', index: 0 }, '', true)).toBe(false);
  });

  it('실제 카테고리가 없으면(빈 계정) 미분류만 있으니 거절하지 않는다', () => {
    expect(isRejectedDrop({ categoryId: '', index: 0 }, 'ex', false)).toBe(false);
  });

  it('실제 카테고리로의 이동은 항상 허용', () => {
    expect(isRejectedDrop({ categoryId: 'st', index: 1 }, 'ex', true)).toBe(false);
  });
});

// 그룹 넷: 일정 0~100, 공부 100~200, 취미 200~300, 미분류 300~400 (부모 기준 onLayout).
const GROUPS = new Map<string, GroupSlot>([
  ['일정', { y: 0, height: 100 }],
  ['공부', { y: 100, height: 100 }],
  ['취미', { y: 200, height: 100 }],
  ['', { y: 300, height: 100 }],
]);
const REAL = ['일정', '공부', '취미'];

describe('resolveGroupDrop (카테고리 헤더 드래그, 2026-09-08)', () => {
  it('아래 그룹 중심을 넘기면 그 아래 index', () => {
    // 일정 중심 50 + 120 = 170 > 공부 중심 150 → 공부 다음(1).
    expect(resolveGroupDrop(GROUPS, REAL, '일정', 120)).toBe(1);
  });

  it('중심을 못 넘기면 제자리', () => {
    expect(resolveGroupDrop(GROUPS, REAL, '일정', 80)).toBe(0);
    expect(resolveGroupDrop(GROUPS, REAL, '취미', -80)).toBe(2);
  });

  it('미분류 아래로 끌어도 미분류는 세지 않는다 — 실제 카테고리 끝에 멈춘다', () => {
    expect(resolveGroupDrop(GROUPS, REAL, '일정', 1000)).toBe(2);
    expect(resolveGroupDrop(GROUPS, REAL, '취미', 1000)).toBe(2);
  });

  it('들린 그룹의 레이아웃이 없으면(측정 전) null', () => {
    expect(resolveGroupDrop(GROUPS, REAL, '없음', 10)).toBeNull();
  });
});

describe('mergeOrderedSubset (2026-09-08)', () => {
  it('보이는 카테고리끼리만 자리를 바꾸고 안 보이는 것은 원래 자리', () => {
    expect(mergeOrderedSubset(['A', 'B', 'C', 'D'], ['D', 'A', 'C'])).toEqual(['D', 'B', 'A', 'C']);
  });

  it('부분 순서가 전체와 같으면 그대로', () => {
    expect(mergeOrderedSubset(['A', 'B', 'C'], ['A', 'B', 'C'])).toEqual(['A', 'B', 'C']);
  });

  it('전체에 없는 id(삭제된 카테고리)는 버린다', () => {
    expect(mergeOrderedSubset(['A', 'B'], ['B', 'X', 'A'])).toEqual(['B', 'A']);
  });
});
