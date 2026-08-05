import {
  type DragSlot,
  reorderedIds,
  resolveDrop,
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
