import { UNCATEGORIZED_META, type RoutineCategoryMeta } from '@/constants/routines';
import { groupByCategory } from '@/utils/category-groups';

const cat = (id: string): RoutineCategoryMeta =>
  ({
    id,
    name: id,
    icon: 'sparkle',
    color: '#000000',
    visibility: 'public',
  }) as RoutineCategoryMeta;

describe('groupByCategory (장부 26번)', () => {
  const categories = [cat('a'), cat('b'), cat('c')];

  it('카테고리 순서대로, 빈 묶음은 빼고', () => {
    const items = [
      { id: 1, category: 'b' },
      { id: 2, category: 'a' },
      { id: 3, category: 'b' },
    ];
    expect(
      groupByCategory(items, categories).map((g) => [g.meta.id, g.items.map((i) => i.id)]),
    ).toEqual([
      ['a', [2]],
      ['b', [1, 3]],
    ]);
  });

  it('카테고리 없음·목록에 없는 카테고리는 마지막 미분류 하나로', () => {
    const items = [{ id: 1, category: 'gone' }, { id: 2 }, { id: 3, category: 'a' }];
    const groups = groupByCategory(items, categories);
    expect(groups.at(-1)?.meta).toBe(UNCATEGORIZED_META);
    expect(groups.at(-1)?.items.map((i) => i.id)).toEqual([1, 2]);
    expect(groups).toHaveLength(2);
  });

  it('카테고리가 하나도 없으면 전부 미분류, 항목도 없으면 빈 배열', () => {
    expect(groupByCategory([{ id: 1, category: 'x' }], []).map((g) => g.meta)).toEqual([
      UNCATEGORIZED_META,
    ]);
    expect(groupByCategory([], categories)).toEqual([]);
  });
});
