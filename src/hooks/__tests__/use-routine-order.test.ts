import { applyRoutineOrder } from '@/hooks/use-routine-order';

const items = (ids: string[]) => ids.map((id) => ({ id, title: id }));

describe('applyRoutineOrder (#716)', () => {
  it('저장된 순서대로 정렬한다', () => {
    const out = applyRoutineOrder(items(['a', 'b', 'c']), ['c', 'a', 'b']);
    expect(out.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('순서 맵에 없는 항목(새 루틴)은 원래 순서로 뒤에 붙는다', () => {
    const out = applyRoutineOrder(items(['a', 'b', 'c', 'd']), ['c', 'a']);
    expect(out.map((i) => i.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('저장된 순서에 있으나 지금 목록에 없는 id는 조용히 무시한다', () => {
    const out = applyRoutineOrder(items(['a', 'b']), ['x', 'b', 'a']);
    expect(out.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('순서가 없으면(undefined·빈 배열) 원본을 그대로 돌려준다', () => {
    expect(applyRoutineOrder(items(['a', 'b']), undefined).map((i) => i.id)).toEqual(['a', 'b']);
    expect(applyRoutineOrder(items(['a', 'b']), []).map((i) => i.id)).toEqual(['a', 'b']);
  });
});
