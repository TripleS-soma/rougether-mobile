import { type Routine, type RoutineCategoryMeta, UNCATEGORIZED_META } from '@/constants/routines';
import { applyRoutineOrder } from '@/hooks/use-routine-order';

/**
 * 나의 방 카테고리 그룹 계산 (순수 함수) — 방 '오늘' 리스트, 달력 클라이언트
 * 날짜(오늘), 달력 서버 날짜 세 벌이 같은 규칙(카테고리 순서 → 미분류 꼬리 →
 * 완료 하단 가라앉힘)을 공유한다. 화면은 이 함수들을 `useMemo`로 감싸 참조를
 * 고정한다.
 */
export type CategoryGroup<T> = { meta: RoutineCategoryMeta; items: T[] };

/**
 * Checked items sink below unchecked ones within their category (stable in
 * each half), keeping the remaining work on top of every list.
 */
export function sinkDone<T>(items: T[], done: (item: T) => boolean): T[] {
  return [...items.filter((i) => !done(i)), ...items.filter(done)];
}

/**
 * Quick-add is limited to real (non-deleted) categories; 미분류(pseudo)와
 * 미션 연동 카테고리는 임의 추가를 막는다 — 방탭·달력탭 공통 규칙 (#323).
 * 예외 (#626): 완전 빈 계정의 미분류(id '')는 첫 추가의 출발점이라 연다 —
 * categoryId 없이 생성되고, 다음 로드의 고아 입양이 실제 미분류로 수렴한다.
 */
export function canQuickAddCategory(
  categoryId: string | undefined,
  categories: RoutineCategoryMeta[],
  quickAddDisabledCategoryIds: string[],
): boolean {
  return categoryId === ''
    ? categories.length === 0
    : !!categoryId &&
        categories.some((c) => c.id === categoryId) &&
        !quickAddDisabledCategoryIds.includes(categoryId);
}

/** 무소속이거나 삭제된(미상) 카테고리를 가리키는 항목 — 미분류 그룹 몫. */
function isOrphan(routine: Routine, knownIds: string[]): boolean {
  return !routine.category || !knownIds.includes(routine.category);
}

/**
 * 방 '오늘' 리스트의 카테고리 그룹.
 *
 * Routines with a missing/unknown category land in the last group; with no
 * categories at all, render a single pseudo-group so they stay visible
 * (routines can exist without any category, e.g. after a category delete).
 * 미분류(카테고리 삭제 UNASSIGN 산물, #517)는 마지막 카테고리에 섞지 않고
 * 전용 '미분류' 그룹으로 맨 뒤에 붙인다. 완전 빈 계정도 미분류 그룹을
 * 세운다 (#626) — 첫 가입자가 카테고리 개념 없이도 그 자리에서 바로
 * 추가를 시작한다(퀵애드는 categoryId 없이 생성 → 고아 입양이 수렴).
 */
export function groupRoomRoutines({
  routines,
  categories,
  routineOrder,
  isDone,
}: {
  /** 오늘 예정된 루틴만 (isScheduledOn 필터 후). */
  routines: Routine[];
  categories: RoutineCategoryMeta[];
  /** 수동 순서 맵 (#716) — `{ [categoryId]: [routineId...] }`. */
  routineOrder?: Record<string, string[]>;
  /** 오늘 완료 여부 (routine id 기준). */
  isDone: (id: string) => boolean;
}): CategoryGroup<Routine>[] {
  const knownIds = categories.map((c) => c.id);
  const hasUncategorizedRoom = routines.some((r) => isOrphan(r, knownIds));
  const metas =
    categories.length > 0
      ? [...categories, ...(hasUncategorizedRoom ? [UNCATEGORIZED_META] : [])]
      : [UNCATEGORIZED_META];
  return metas.map((cat) => {
    // 미분류 그룹(id '')이 무소속·미상 카테고리 항목을 받는다 (#517).
    const isUncategorized = cat.id === '';
    const inCat = routines.filter((r) => {
      if (r.category === cat.id) return true;
      return isUncategorized && isOrphan(r, knownIds);
    });
    // 수동 순서(#716)를 미완료 항목에 적용한 뒤 완료를 하단으로 가라앉힌다 —
    // 순서는 "내가 정한 미완료 배치"가 진실이고, 완료는 자동으로 밀린다.
    const items = sinkDone(applyRoutineOrder(inCat, routineOrder?.[cat.id]), (r) => isDone(r.id));
    return { meta: cat, items };
  });
}

/**
 * 달력 클라이언트 날짜(오늘)의 카테고리 그룹 — 방탭 섹션을 그대로 비춘다
 * (emoji + colored label + done count). Empty groups still render when they
 * can quick-add — the + must stay reachable on any date, like the room tab (#323).
 */
export function groupCalendarClientRoutines({
  routines,
  categories,
  routineOrder,
  isDone,
  canQuickAdd,
}: {
  /** 선택한 날짜에 예정된 루틴만. */
  routines: Routine[];
  categories: RoutineCategoryMeta[];
  /** 수동 순서 맵 (#716) — 달력도 방 탭과 같은 순서로 그린다 (2026-09-08). */
  routineOrder?: Record<string, string[]>;
  /** 선택한 날짜의 완료 여부 (routine id 기준). */
  isDone: (id: string) => boolean;
  canQuickAdd: (categoryId?: string) => boolean;
}): CategoryGroup<Routine>[] {
  const knownIds = categories.map((c) => c.id);
  const hasUncategorizedCal = routines.some((r) => isOrphan(r, knownIds));
  const calGroupsBase =
    categories.length > 0
      ? [...categories, ...(hasUncategorizedCal ? [UNCATEGORIZED_META] : [])]
      : routines.length > 0
        ? [UNCATEGORIZED_META]
        : [];
  return calGroupsBase
    .map((cat) => {
      const isUncategorized = cat.id === '';
      const items = routines.filter(
        (r) => r.category === cat.id || (isUncategorized && isOrphan(r, knownIds)),
      );
      return {
        meta: cat,
        items: sinkDone(applyRoutineOrder(items, routineOrder?.[cat.id]), (r) => isDone(r.id)),
      };
    })
    .filter((g) => g.items.length > 0 || canQuickAdd(g.meta.id));
}

/**
 * 달력 서버 날짜(GET /calendar)의 카테고리 그룹. 기록 당시 categoryId로 묶고,
 * 그룹 순서는 **현재 카테고리의 사용자 정렬**(`categories` 순, 방 탭·오늘과 동일)을
 * 따른다 — 종전엔 서버 응답 순서(categoryId asc)라 카테고리 순서를 바꿔도 과거·
 * 미래 날짜에는 반영되지 않았다(2026-09-08). 삭제된 카테고리(`catMeta`로 이름을
 * 되찾음)는 그 뒤에 등장 순서대로, 미분류는 맨 뒤. `dayItems`가 없으면(로딩 중)
 * undefined.
 */
export function groupCalendarServerItems<
  T extends { id: string; category?: string; completed: boolean },
>({
  dayItems,
  catMeta,
  categories,
  routineOrder,
  canQuickAdd,
}: {
  dayItems: T[] | undefined;
  /** 삭제된 것까지 포함한 전체 카테고리 — 기록 당시 이름·색을 되찾는다. */
  catMeta: RoutineCategoryMeta[];
  /** 현재(살아 있는) 카테고리 — 빈 그룹 헤더용. */
  categories: RoutineCategoryMeta[];
  /**
   * 수동 순서 맵 (#716) — 서버 응답 순서 대신 방 탭과 같은 순서로 (2026-09-08).
   * 없으면 롱프레스 재정렬이 달력에서 아무 변화도 못 보여준다.
   */
  routineOrder?: Record<string, string[]>;
  canQuickAdd: (categoryId?: string) => boolean;
}): CategoryGroup<T>[] | undefined {
  if (!dayItems) return undefined;
  const byCat = new Map<string, T[]>();
  for (const item of dayItems) {
    const key = item.category ?? '';
    byCat.set(key, [...(byCat.get(key) ?? []), item]);
  }
  const orderedItems = (key: string) =>
    sinkDone(applyRoutineOrder(byCat.get(key) ?? [], routineOrder?.[key]), (i) => i.completed);
  const toGroup = (key: string) => ({
    meta: catMeta.find((c) => c.id === key) ?? UNCATEGORIZED_META,
    items: orderedItems(key),
  });
  const groups: CategoryGroup<T>[] = [];
  // 1) 현재 카테고리를 사용자 순서대로 — 그 날 항목이 없어도 퀵애드 가능하면 빈 헤더 (#323).
  for (const cat of categories) {
    if (byCat.has(cat.id)) groups.push({ meta: cat, items: orderedItems(cat.id) });
    else if (canQuickAdd(cat.id)) groups.push({ meta: cat, items: [] });
  }
  // 2) 현재에 없는(삭제된) 카테고리는 등장 순서대로, 3) 미분류('')는 맨 뒤.
  const current = new Set(categories.map((c) => c.id));
  for (const key of byCat.keys()) {
    if (key !== '' && !current.has(key)) groups.push(toGroup(key));
  }
  if (byCat.has('')) groups.push(toGroup(''));
  return groups;
}
