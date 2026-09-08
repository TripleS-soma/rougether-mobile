import {
  canQuickAddCategory,
  groupCalendarClientRoutines,
  groupCalendarServerItems,
  groupRoomRoutines,
  sinkDone,
} from '@/components/screens/my-room/grouping';
import { type Routine, type RoutineCategoryMeta } from '@/constants/routines';

const cat = (id: string): RoutineCategoryMeta => ({
  id,
  name: id,
  icon: 'dumbbell',
  color: '#7FA87F',
  visibility: 'public',
});
const routine = (id: string, category?: string): Routine => ({
  id,
  title: id,
  kind: 'routine',
  category,
});
const ids = (items: { id: string }[]) => items.map((i) => i.id);
const groupIds = (groups: { meta: { id: string } }[]) => groups.map((g) => g.meta.id);

describe('sinkDone', () => {
  it('완료 항목을 뒤로 보내되 각 절반 안의 순서는 유지한다', () => {
    const done = new Set(['a', 'c']);
    expect(sinkDone(['a', 'b', 'c', 'd'], (x) => done.has(x))).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('groupRoomRoutines', () => {
  const categories = [cat('건강'), cat('공부')];

  it('categories 순서대로 그룹을 만들고, 무소속·미상 항목은 미분류 그룹으로 맨 뒤에 붙는다 (#517)', () => {
    const groups = groupRoomRoutines({
      routines: [
        routine('x', '공부'),
        routine('o1'),
        routine('h', '건강'),
        routine('o2', '삭제됨'),
      ],
      categories,
      isDone: () => false,
    });
    expect(groupIds(groups)).toEqual(['건강', '공부', '']);
    expect(groups[2].meta.name).toBe('미분류');
    expect(ids(groups[0].items)).toEqual(['h']);
    expect(ids(groups[1].items)).toEqual(['x']);
    expect(ids(groups[2].items)).toEqual(['o1', 'o2']);
  });

  it('무소속 항목이 없으면 미분류 그룹을 만들지 않는다', () => {
    const groups = groupRoomRoutines({
      routines: [routine('h', '건강')],
      categories,
      isDone: () => false,
    });
    expect(groupIds(groups)).toEqual(['건강', '공부']);
    expect(groups[1].items).toEqual([]);
  });

  it('카테고리가 하나도 없으면(빈 계정) 미분류 그룹 하나를 세운다 (#626)', () => {
    expect(
      groupIds(groupRoomRoutines({ routines: [], categories: [], isDone: () => false })),
    ).toEqual(['']);
  });

  it('완료 항목은 카테고리 안에서 아래로 가라앉는다', () => {
    const done = new Set(['a', 'c']);
    const groups = groupRoomRoutines({
      routines: [routine('a', '건강'), routine('b', '건강'), routine('c', '건강')],
      categories: [cat('건강')],
      isDone: (id) => done.has(id),
    });
    expect(ids(groups[0].items)).toEqual(['b', 'a', 'c']);
  });

  it('routineOrder는 미완료 항목에만 적용되고 완료는 그 뒤에 남는다 (#716)', () => {
    const done = new Set(['a']);
    const groups = groupRoomRoutines({
      routines: [routine('a', '건강'), routine('b', '건강'), routine('c', '건강')],
      categories: [cat('건강')],
      routineOrder: { 건강: ['c', 'a', 'b'] },
      isDone: (id) => done.has(id),
    });
    expect(ids(groups[0].items)).toEqual(['c', 'b', 'a']);
  });
});

describe('groupCalendarClientRoutines', () => {
  const categories = [cat('건강'), cat('공부')];

  it('항목이 없는 그룹은 퀵애드 가능할 때만 남는다 (#323)', () => {
    const groups = groupCalendarClientRoutines({
      routines: [routine('h', '건강')],
      categories,
      isDone: () => false,
      canQuickAdd: (id) => id === '공부',
    });
    expect(groupIds(groups)).toEqual(['건강', '공부']);

    const noAdd = groupCalendarClientRoutines({
      routines: [routine('h', '건강')],
      categories,
      isDone: () => false,
      canQuickAdd: () => false,
    });
    expect(groupIds(noAdd)).toEqual(['건강']);
  });

  it('카테고리도 항목도 없으면 빈 목록 — 방탭과 달리 미분류를 세우지 않는다', () => {
    expect(
      groupCalendarClientRoutines({
        routines: [],
        categories: [],
        isDone: () => false,
        canQuickAdd: () => true,
      }),
    ).toEqual([]);
  });

  it('무소속 항목은 미분류 그룹으로, 완료는 아래로', () => {
    const done = new Set(['o1']);
    const groups = groupCalendarClientRoutines({
      routines: [routine('o1'), routine('o2')],
      categories,
      isDone: (id) => done.has(id),
      canQuickAdd: () => false,
    });
    expect(groupIds(groups)).toEqual(['']);
    expect(ids(groups[0].items)).toEqual(['o2', 'o1']);
  });
});

describe('groupCalendarServerItems', () => {
  const item = (id: string, completed: boolean, category?: string) => ({
    id,
    kind: 'todo' as const,
    title: id,
    completed,
    category,
  });

  it('dayItems가 없으면(로딩 중) undefined', () => {
    expect(
      groupCalendarServerItems({
        dayItems: undefined,
        catMeta: [],
        categories: [],
        canQuickAdd: () => true,
      }),
    ).toBeUndefined();
  });

  it('기록 당시 카테고리로 서버 순서대로 묶고, 삭제된 카테고리는 catMeta로 이름을 되찾는다', () => {
    const groups = groupCalendarServerItems({
      dayItems: [item('a', false, '99'), item('b', false, '건강'), item('c', false)],
      catMeta: [cat('건강'), { ...cat('99'), name: '옛것', deleted: true }],
      categories: [cat('건강')],
      canQuickAdd: () => false,
    });
    expect(groups?.map((g) => g.meta.name)).toEqual(['옛것', '건강', '미분류']);
    expect(ids(groups![2].items)).toEqual(['c']);
  });

  it('완료 항목은 아래로 가라앉는다', () => {
    const groups = groupCalendarServerItems({
      dayItems: [item('a', true, '건강'), item('b', false, '건강')],
      catMeta: [cat('건강')],
      categories: [cat('건강')],
      canQuickAdd: () => false,
    });
    expect(ids(groups![0].items)).toEqual(['b', 'a']);
  });

  it('그 날 항목이 없는 현재 카테고리도 퀵애드 가능하면 빈 그룹으로 붙는다 (#323)', () => {
    const groups = groupCalendarServerItems({
      dayItems: [item('a', false, '건강')],
      catMeta: [cat('건강'), cat('공부'), cat('일정')],
      categories: [cat('건강'), cat('공부'), cat('일정')],
      canQuickAdd: (id) => id !== '일정',
    });
    expect(groupIds(groups!)).toEqual(['건강', '공부']);
    expect(groups![1].items).toEqual([]);
  });
});

describe('canQuickAddCategory', () => {
  const categories = [cat('건강'), cat('일정')];

  it('실재하는 카테고리만 허용하고, 미션 연동(disabled)·미상·undefined는 막는다 (#272·#323)', () => {
    expect(canQuickAddCategory('건강', categories, ['일정'])).toBe(true);
    expect(canQuickAddCategory('일정', categories, ['일정'])).toBe(false);
    expect(canQuickAddCategory('없음', categories, [])).toBe(false);
    expect(canQuickAddCategory(undefined, categories, [])).toBe(false);
  });

  it("미분류('')는 카테고리가 하나도 없는 빈 계정에서만 연다 (#626)", () => {
    expect(canQuickAddCategory('', categories, [])).toBe(false);
    expect(canQuickAddCategory('', [], [])).toBe(true);
  });
});
