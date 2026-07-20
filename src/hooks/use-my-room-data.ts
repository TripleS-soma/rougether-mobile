/**
 * My-room data, backed by the Rougether User API. Fetches categories, routines,
 * todos, today's completion and wallet on mount, and exposes the same callback
 * shapes the screens already use — so the app shell wires straight through.
 *
 * The 달력 tab reads non-today dates from GET /calendar (loadCalendarDay);
 * completion toggles are server-accepted for today and past dates (past
 * routine completions pay 0 coins); future dates are rejected.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  completeRoutine,
  completeTodo,
  createCategory,
  createRoutine,
  createTodo,
  deleteCategory as apiDeleteCategory,
  deleteRoutine as apiDeleteRoutine,
  deleteTodo,
  fetchCalendarDay,
  fetchCategories,
  fetchMe,
  fetchRoutines,
  fetchToday,
  fetchTodos,
  fetchWallets,
  uncompleteRoutine,
  uncompleteTodo,
  updateCategory as apiUpdateCategory,
  updateMe,
  updateRoutine as apiUpdateRoutine,
  updateTodo,
} from '@/api';
import {
  toAppCategory,
  toAppRoutine,
  toAppTodo,
  toCalendarItems,
  toCategoryCreate,
  toRoutineCreate,
  toServerItemId,
  toRoutineUpdate,
  toTodoCreate,
  toTodoUpdate,
  toWallet,
  todayCompletions,
} from '@/api/adapters';
import { useToast } from '@/components/ui/toast';
import { DEFAULT_WALLET, type Wallet } from '@/constants/currency';
import {
  type NewRoutine,
  type Routine,
  type RoutineCategoryMeta,
  UNCATEGORIZED_META,
} from '@/constants/routines';
import type { CalendarDayItem } from '@/components/screens/my-room-screen';
import { todayIso } from '@/utils/datetime';

export function useMyRoomData() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [completions, setCompletions] = useState<Record<string, string[]>>({});
  const [categories, setCategories] = useState<RoutineCategoryMeta[]>([]);
  // Active + deleted categories — past records resolve their original meta here.
  const [allCategories, setAllCategories] = useState<RoutineCategoryMeta[]>([]);
  // 달력 tab data per date (server GET /calendar), refreshed on each pick.
  const [calendarDays, setCalendarDays] = useState<Record<string, CalendarDayItem[]>>({});
  const [wallet, setWallet] = useState<Wallet>(DEFAULT_WALLET);
  // Identity + streak, surfaced in the my-room header / profile edit.
  const [nickname, setNickname] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { show: toast } = useToast();

  const reload = useCallback(async () => {
    const [cats, rts, tds, today, wals, me] = await Promise.all([
      // includeDeleted → deleted categories still resolve for past records.
      fetchCategories(true),
      fetchRoutines(),
      fetchTodos(),
      fetchToday(),
      fetchWallets(),
      fetchMe(),
    ]);
    const appCatsAll = cats.map((c, i) => toAppCategory(c, i));
    let appCats = appCatsAll.filter((c) => !c.deleted);
    let items = [...rts.map(toAppRoutine), ...tds.map(toAppTodo)];

    // Uncategorized routines must not exist: adopt any item without a (known)
    // category into a real 기타 category, creating it server-side if needed.
    // (Legacy data, or the server nulling categoryId on category delete.)
    const known = new Set(appCats.map((c) => c.id));
    const isOrphan = (r: Routine) => !r.category || !known.has(r.category);
    if (items.some(isOrphan)) {
      try {
        let fallback = appCats.find((c) => c.label === UNCATEGORIZED_META.label);
        if (!fallback) {
          const created = await createCategory(
            toCategoryCreate(UNCATEGORIZED_META, appCats.length),
          );
          fallback = toAppCategory(created, appCats.length);
          appCats = [...appCats, fallback];
        }
        const target = fallback.id;
        await Promise.all(
          items
            .filter(isOrphan)
            .map((o) =>
              o.kind === 'todo'
                ? updateTodo(toServerItemId(o.id), toTodoUpdate(o, { category: target }))
                : apiUpdateRoutine(toServerItemId(o.id), toRoutineUpdate(o, { category: target })),
            ),
        );
        items = items.map((r) => (isOrphan(r) ? { ...r, category: target } : r));
      } catch {
        // Non-fatal: the pseudo 기타 group still keeps them visible.
      }
    }

    setCategories(appCats);
    // Active (incl. a just-created 기타) first, deleted ones behind for lookup.
    setAllCategories([...appCats, ...appCatsAll.filter((c) => c.deleted)]);
    setRoutines(items);
    setCompletions(todayCompletions(today, todayIso()));
    setWallet(toWallet(wals));
    setStreak(today.streak?.currentCount ?? 0);
    if (me.nickname) setNickname(me.nickname);
    if (me.bio != null) setBio(me.bio);
  }, []);

  // Initial load + retry share the same load cycle (spinner → data | error).
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  }, [reload]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshWallet = useCallback(async () => {
    try {
      setWallet(toWallet(await fetchWallets()));
    } catch {
      // Non-fatal; keep the last known balance.
    }
  }, []);

  /**
   * Load a date's 달력 list from GET /calendar. Always refetches (routine edits
   * change future dates); the previous data stays visible until it lands.
   */
  const loadCalendarDay = useCallback(
    async (date: string) => {
      try {
        const day = await fetchCalendarDay(date);
        setCalendarDays((prev) => ({ ...prev, [date]: toCalendarItems(day) }));
      } catch {
        toast('달력 기록을 불러오지 못했어요', 'error');
      }
    },
    [toast],
  );

  const findItem = (id: string) => routines.find((r) => r.id === id);

  // 시트 액션(이름/시간/날짜/삭제)이 달력 탭의 서버 캐시에도 반영되도록,
  // 캐시된 날짜들을 재조회한다 (#323). 방문한 날짜 수만큼만 호출된다.
  const refreshCachedCalendarDays = () => {
    for (const date of Object.keys(calendarDays)) void loadCalendarDay(date);
  };

  /**
   * `onCompleted` fires only after a successful completion (not an
   * un-complete) — the shell uses it to auto-contribute linked house missions.
   */
  const toggleCompletion = async (
    id: string,
    date: string,
    onCompleted?: (item: Routine) => void,
  ) => {
    const item = findItem(id);
    const wasDone = (completions[id] ?? []).includes(date);
    // Optimistic update; revert on failure.
    setCompletions((prev) => {
      const dates = prev[id] ?? [];
      return { ...prev, [id]: wasDone ? dates.filter((d) => d !== date) : [...dates, date] };
    });
    try {
      const numId = toServerItemId(id);
      let rewardAmount: number | undefined;
      if (item?.kind === 'todo') {
        if (wasDone) await uncompleteTodo(numId);
        else rewardAmount = (await completeTodo(numId)).rewardAmount;
      } else {
        if (wasDone) await uncompleteRoutine(numId, date);
        else rewardAmount = (await completeRoutine(numId, date)).rewardAmount;
      }
      // Completion pays out server-side — surface the actual amount.
      if (!wasDone && rewardAmount) toast(`+${rewardAmount} 코인 획득!`, 'success');
      await refreshWallet();
      if (!wasDone && item) onCompleted?.(item);
    } catch {
      setCompletions((prev) => {
        const dates = prev[id] ?? [];
        return { ...prev, [id]: wasDone ? [...dates, date] : dates.filter((d) => d !== date) };
      });
      toast('완료 처리에 실패했어요', 'error');
    }
  };

  /**
   * 달력 (non-today) completion toggle. Todos flip status (date-agnostic);
   * routines log against the picked date — the server accepts past dates
   * (reward 0 for non-today, #183) and rejects future ones (screen blocks
   * those first). Refetches the day so the list mirrors the server.
   */
  const toggleCalendarItem = async (item: CalendarDayItem, date: string) => {
    try {
      const numId = toServerItemId(item.id);
      let rewardAmount: number | undefined;
      if (item.kind === 'todo') {
        if (item.completed) await uncompleteTodo(numId);
        else rewardAmount = (await completeTodo(numId)).rewardAmount;
      } else {
        if (item.completed) await uncompleteRoutine(numId, date);
        else rewardAmount = (await completeRoutine(numId, date)).rewardAmount;
      }
      if (rewardAmount) toast(`+${rewardAmount} 코인 획득!`, 'success');
      await Promise.all([loadCalendarDay(date), refreshWallet()]);
    } catch {
      toast('완료 처리에 실패했어요', 'error');
    }
  };

  const quickAddTodo = async (category: string, title: string, dueDate: string) => {
    try {
      const created = await createTodo(toTodoCreate(category, title, dueDate));
      setRoutines((prev) => [...prev, toAppTodo(created)]);
      // 달력의 서버 백업 날짜(오늘 외)에 추가한 경우 그 날짜 기록을 재조회해
      // 목록에 즉시 반영한다 (#323).
      if (dueDate !== todayIso()) void loadCalendarDay(dueDate);
    } catch {
      toast('할 일을 추가하지 못했어요', 'error');
    }
  };

  const addRoutine = async (n: NewRoutine) => {
    try {
      const created = await createRoutine(toRoutineCreate(n));
      setRoutines((prev) => [...prev, toAppRoutine(created)]);
    } catch {
      toast('루틴을 만들지 못했어요', 'error');
    }
  };

  const updateRoutine = async (id: string, n: NewRoutine) => {
    const item = findItem(id);
    if (!item) return;
    try {
      if (item.kind === 'todo') {
        const updated = await updateTodo(toServerItemId(id), toTodoUpdate(item, n));
        setRoutines((prev) => prev.map((r) => (r.id === id ? toAppTodo(updated) : r)));
      } else {
        const updated = await apiUpdateRoutine(toServerItemId(id), toRoutineUpdate(item, n));
        setRoutines((prev) => prev.map((r) => (r.id === id ? toAppRoutine(updated) : r)));
      }
    } catch {
      toast('수정에 실패했어요', 'error');
    }
  };

  const renameRoutine = async (id: string, title: string) => {
    const item = findItem(id);
    if (!item) return;
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, title } : r)));
    try {
      if (item.kind === 'todo') await updateTodo(toServerItemId(id), toTodoUpdate(item, { title }));
      else await apiUpdateRoutine(toServerItemId(id), toRoutineUpdate(item, { title }));
      refreshCachedCalendarDays();
    } catch {
      setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, title: item.title } : r)));
      toast('수정에 실패했어요', 'error');
    }
  };

  const updateRoutineTime = async (id: string, alarmEnabled: boolean, time: string) => {
    const item = findItem(id);
    if (!item) return;
    // 투두 마감 시각(dueTime) 해제는 서버 미지원(null = 기존 값 유지) — 켠 채
    // 저장만 반영하고, 끄기는 정직하게 안내한다 (#325).
    if (item.kind === 'todo' && !alarmEnabled) {
      if (item.time) toast('할 일 시간 삭제는 서버 준비 중이에요', 'error');
      return;
    }
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, alarmEnabled, time } : r)));
    try {
      if (item.kind === 'todo') {
        await updateTodo(toServerItemId(id), toTodoUpdate(item, { alarmEnabled, time }));
      } else {
        await apiUpdateRoutine(toServerItemId(id), toRoutineUpdate(item, { alarmEnabled, time }));
      }
      refreshCachedCalendarDays();
    } catch {
      setRoutines((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, alarmEnabled: item.alarmEnabled, time: item.time } : r,
        ),
      );
      toast('수정에 실패했어요', 'error');
    }
  };

  /** Change a todo's due date (메뉴 시트 → 날짜 바꾸기). */
  const updateTodoDueDate = async (id: string, dueDate: string) => {
    const item = findItem(id);
    if (!item || item.kind !== 'todo') return;
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, dueDate } : r)));
    try {
      await updateTodo(toServerItemId(id), toTodoUpdate(item, { dueDate }));
      refreshCachedCalendarDays();
    } catch {
      setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, dueDate: item.dueDate } : r)));
      toast('수정에 실패했어요', 'error');
    }
  };

  /**
   * 루틴의 그 날 몫 하나를 다른 날짜로 옮기기 (메뉴 → 날짜 바꾸기 on a
   * routine). The repeat schedule stays untouched; a one-off todo with the
   * routine's title lands on the picked date. The server has no
   * per-occurrence skip yet, so the original day's instance still shows.
   */
  const moveRoutineOccurrence = async (id: string, dueDate: string) => {
    const item = findItem(id);
    if (!item || item.kind === 'todo') return;
    try {
      const created = await createTodo(toTodoCreate(item.category, item.title, dueDate));
      setRoutines((prev) => [...prev, toAppTodo(created)]);
      refreshCachedCalendarDays();
      toast('선택한 날짜에 할 일로 추가했어요', 'success');
    } catch {
      toast('날짜 변경에 실패했어요', 'error');
    }
  };

  const deleteRoutine = async (id: string) => {
    const item = findItem(id);
    if (!item) return;
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    try {
      if (item.kind === 'todo') await deleteTodo(toServerItemId(id));
      else await apiDeleteRoutine(toServerItemId(id));
      refreshCachedCalendarDays();
    } catch {
      setRoutines((prev) => [...prev, item]);
      toast('삭제에 실패했어요', 'error');
    }
  };

  /** Persist the profile (PUT /me) — nickname + bio together, optimistic. */
  const saveProfile = async (nick: string, newBio: string): Promise<boolean> => {
    const before = { nickname, bio };
    setNickname(nick);
    setBio(newBio);
    try {
      await updateMe({ nickname: nick, bio: newBio });
      toast('프로필이 저장되었어요', 'success');
      return true;
    } catch {
      setNickname(before.nickname);
      setBio(before.bio);
      toast('프로필 저장에 실패했어요', 'error');
      return false;
    }
  };

  /**
   * Find a category by label — refreshing from the server first, since another
   * session may have created it (stale local state must not duplicate the
   * house-named category, #272) — creating it only when genuinely absent.
   */
  const ensureCategory = async (cat: RoutineCategoryMeta): Promise<RoutineCategoryMeta | null> => {
    try {
      const cats = await fetchCategories();
      const appCats = cats.map((c, i) => toAppCategory(c, i)).filter((c) => !c.deleted);
      setCategories(appCats);
      const existing = appCats.find((c) => c.label === cat.label);
      if (existing) return existing;
    } catch {
      // Offline lookup fallback: trust local state below.
      const existing = categories.find((c) => c.label === cat.label);
      if (existing) return existing;
    }
    return createRoutineCategory(cat);
  };

  /** Create a category; returns the created meta (null on failure) so callers
   * can immediately file a routine under it (미션 → 루틴 연동). */
  const createRoutineCategory = async (cat: RoutineCategoryMeta) => {
    try {
      const created = await createCategory(toCategoryCreate(cat, categories.length));
      const meta = toAppCategory(created, categories.length);
      setCategories((prev) => [...prev, meta]);
      return meta;
    } catch {
      toast('카테고리를 만들지 못했어요', 'error');
      return null;
    }
  };

  const updateRoutineCategory = async (id: string, cat: RoutineCategoryMeta) => {
    const before = categories;
    // Keep the id and sort position; only name/emoji/visibility change.
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...cat, id } : c)));
    try {
      const sortOrder = categories.findIndex((c) => c.id === id);
      await apiUpdateCategory(
        Number(id),
        toCategoryCreate(cat, sortOrder >= 0 ? sortOrder : undefined),
      );
    } catch {
      setCategories(before);
      toast('카테고리 수정에 실패했어요', 'error');
    }
  };

  /** Persist a new category order (ids top→bottom) — sortOrder = list index. */
  const reorderCategories = async (orderedIds: string[]) => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const next = orderedIds.map((id) => byId.get(id)).filter((c): c is RoutineCategoryMeta => !!c);
    if (next.length !== categories.length) return;
    const before = categories;
    setCategories(next);
    setAllCategories([...next, ...allCategories.filter((c) => c.deleted)]);
    try {
      await Promise.all(
        next.map((cat, i) => apiUpdateCategory(Number(cat.id), toCategoryCreate(cat, i))),
      );
    } catch {
      setCategories(before);
      setAllCategories([...before, ...allCategories.filter((c) => c.deleted)]);
      toast('카테고리 순서 저장에 실패했어요', 'error');
    }
  };

  const deleteRoutineCategory = async (id: string) => {
    // The server refuses to delete a category that still has routines/todos
    // (409 CATEGORY_IN_USE) — check first so the category doesn't flicker away.
    if (routines.some((r) => r.category === id)) {
      toast('카테고리에 루틴이 남아 있어 삭제할 수 없어요', 'error');
      return;
    }
    const before = categories;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    try {
      await apiDeleteCategory(Number(id));
      await reload();
    } catch (err) {
      setCategories(before);
      const inUse = err instanceof ApiError && err.bodyText?.includes('CATEGORY_IN_USE');
      toast(
        inUse ? '카테고리에 루틴이 남아 있어 삭제할 수 없어요' : '카테고리 삭제에 실패했어요',
        'error',
      );
    }
  };

  return {
    routines,
    completions,
    categories,
    allCategories,
    calendarDays,
    loadCalendarDay,
    wallet,
    setWallet,
    nickname,
    bio,
    streak,
    loading,
    error,
    /** Re-run the full load cycle (used by the error state's 다시 시도). */
    retry: load,
    toggleCompletion,
    toggleCalendarItem,
    saveProfile,
    quickAddTodo,
    addRoutine,
    updateRoutine,
    renameRoutine,
    updateRoutineTime,
    updateTodoDueDate,
    moveRoutineOccurrence,
    deleteRoutine,
    createRoutineCategory,
    ensureCategory,
    updateRoutineCategory,
    deleteRoutineCategory,
    reorderCategories,
  };
}
