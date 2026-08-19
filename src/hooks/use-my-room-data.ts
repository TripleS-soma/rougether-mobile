/**
 * My-room data, backed by the Rougether User API. Fetches categories, routines,
 * todos, today's completion and wallet on mount, and exposes the same callback
 * shapes the screens already use — so the app shell wires straight through.
 *
 * The 달력 tab reads non-today dates from GET /calendar (loadCalendarDay);
 * completion toggles are server-accepted for today and past dates (past
 * routine completions pay 0 coins); future dates are rejected.
 *
 * Every action is useCallback-wrapped and the return object is useMemo'd so
 * memoized consumers (#539 memo boundaries) get stable references.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CategoryDeleteMode } from '@/api/categories';
import {
  ApiError,
  ErrorCode,
  completeRoutine,
  completeTodo,
  createCategory,
  createRoutine,
  createTodo,
  deleteCategory as apiDeleteCategory,
  deleteRoutine as apiDeleteRoutine,
  deleteTodo,
  fetchCalendarDay,
  fetchCalendarMonth,
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
import type { HouseMissionContributeResponse } from '@/api/types';
import { todayIso } from '@/utils/datetime';
import { identifyUser, track } from '@/lib/analytics';
import { setErrorUser } from '@/lib/error-reporting';

/** 완료 토글 결과 — 코인 보상액과 서버 자동 미션 기여 결과 (#578). */
export type CompletionToggleResult = {
  /** 지급된 코인 (0 = 일일 상한 도달). */
  rewardAmount: number;
  /** 서버가 연동 미션에 자동 기여한 결과 — null/생략이면 미연동·스킵. */
  houseMissionContribution?: HouseMissionContributeResponse | null;
};

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
        let uncategorized = appCats.find((c) => c.name === UNCATEGORIZED_META.name);
        if (!uncategorized) {
          const created = await createCategory(
            toCategoryCreate(UNCATEGORIZED_META, appCats.length),
          );
          uncategorized = toAppCategory(created, appCats.length);
          appCats = [...appCats, uncategorized];
        }
        const target = uncategorized.id;
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
    if (me.userId != null) {
      identifyUser(me.userId);
      // 에러도 같은 사용자로 묶는다 (#801) — 가명 식별자(서버 회원 id)만.
      setErrorUser(me.userId);
    }
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

  /**
   * 월 캘린더 점 (#838, 서버 #295) — 그 달에 **투두가 있는 날**의 집합.
   * 루틴은 세지 않는다: 대부분의 날에 반복되므로 점을 찍으면 거의 모든
   * 날에 찍혀 아무것도 구분하지 못한다. 서버는 routineCount도 주지만 버린다.
   */
  const [todoDatesByMonth, setTodoDatesByMonth] = useState<Record<string, string[]>>({});
  const loadCalendarMonth = useCallback(async (yearMonth: string) => {
    try {
      const res = await fetchCalendarMonth(yearMonth);
      const marked = (res.days ?? []).flatMap((d) =>
        (d.todoCount ?? 0) > 0 && d.date ? [d.date] : [],
      );
      setTodoDatesByMonth((prev) => ({ ...prev, [yearMonth]: marked }));
    } catch {
      // 점은 보조 정보다 — 실패해도 달력 자체는 쓸 수 있으니 조용히 넘어간다.
    }
  }, []);
  /** 방문한 달을 합친 표시용 집합 — 이미 받은 달은 다시 부르지 않는다. */
  const markedTodoDates = useMemo(
    () => new Set(Object.values(todoDatesByMonth).flat()),
    [todoDatesByMonth],
  );

  const findItem = useCallback((id: string) => routines.find((r) => r.id === id), [routines]);

  // 시트 액션(이름/시간/날짜/삭제)이 달력 탭의 서버 캐시에도 반영되도록,
  // 캐시된 날짜들을 재조회한다 (#323). 방문한 날짜 수만큼만 호출된다.
  const refreshCachedCalendarDays = useCallback(() => {
    for (const date of Object.keys(calendarDays)) void loadCalendarDay(date);
  }, [calendarDays, loadCalendarDay]);

  /**
   * Toggle a completion. Resolves null on an un-complete (or failure); on a
   * completion it resolves the reward plus the server's auto mission
   * contribution (#578) — the shell mirrors that into the house state.
   */
  const toggleCompletion = useCallback(
    async (id: string, date: string): Promise<CompletionToggleResult | null> => {
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
        let contribution: HouseMissionContributeResponse | null | undefined;
        if (item?.kind === 'todo') {
          if (wasDone) await uncompleteTodo(numId);
          else rewardAmount = (await completeTodo(numId)).rewardAmount;
        } else {
          // 루틴 완료·취소는 **스트릭을 바꾼다.** 서버가 갱신된 값을 응답에
          // 실어주므로 클라이언트가 다시 셀 필요가 없다 — 예전엔 그 값을 버려서
          // /today를 다시 부를 때까지 헤더의 🔥 일수가 옛 값이었다 (#895).
          // 투두는 스트릭에 안 들어간다(성공일 판정은 루틴 완료만 본다).
          if (wasDone) {
            const streakAfter = await uncompleteRoutine(numId, date);
            if (typeof streakAfter?.currentCount === 'number') setStreak(streakAfter.currentCount);
          } else {
            const log = await completeRoutine(numId, date);
            rewardAmount = log.rewardAmount;
            // 오늘(KST) 완료면 서버가 연동 미션에 자동 기여한 결과가 실려온다.
            contribution = log.houseMissionContribution;
            if (typeof log.streak?.currentCount === 'number') setStreak(log.streak.currentCount);
          }
        }
        // Completion pays out server-side — surface the actual amount. 일일
        // 상한을 다 받은 오늘 완료(보상 0)는 코인 대신 상한 안내 (#444);
        // 과거 날짜는 원래 보상 0이라(#183) 조용히 지나간다.
        if (!wasDone && rewardAmount) toast(`+${rewardAmount} 코인 획득!`, 'success');
        else if (!wasDone && date === todayIso()) toast('오늘 받을 수 있는 코인을 다 모았어요');
        if (!wasDone) track('routine_complete', { kind: item?.kind ?? 'routine' });
        await refreshWallet();
        return wasDone
          ? null
          : { rewardAmount: rewardAmount ?? 0, houseMissionContribution: contribution };
      } catch {
        setCompletions((prev) => {
          const dates = prev[id] ?? [];
          return { ...prev, [id]: wasDone ? [...dates, date] : dates.filter((d) => d !== date) };
        });
        toast('완료 처리에 실패했어요', 'error');
        return null;
      }
    },
    [completions, findItem, refreshWallet, toast],
  );

  /**
   * 달력 (non-today) completion toggle. Todos flip status (date-agnostic);
   * routines log against the picked date — the server accepts past dates
   * (reward 0 for non-today, #183) and rejects future ones (screen blocks
   * those first). Refetches the day so the list mirrors the server.
   */
  const toggleCalendarItem = useCallback(
    async (item: CalendarDayItem, date: string) => {
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
    },
    [loadCalendarDay, refreshWallet, toast],
  );

  const quickAddTodo = useCallback(
    async (category: string, title: string, dueDate: string) => {
      try {
        const created = await createTodo(toTodoCreate(category, title, dueDate));
        setRoutines((prev) => [...prev, toAppTodo(created)]);
        track('routine_create', { kind: 'todo' });
        // 달력의 서버 백업 날짜(오늘 외)에 추가한 경우 그 날짜 기록을 재조회해
        // 목록에 즉시 반영한다 (#323).
        if (dueDate !== todayIso()) void loadCalendarDay(dueDate);
      } catch {
        toast('할 일을 추가하지 못했어요', 'error');
      }
    },
    [loadCalendarDay, toast],
  );

  // 성공 여부를 돌려준다 — 온보딩 미션(첫 루틴 등록, #571)이 성공 시점에 후킹.
  const addRoutine = useCallback(
    async (n: NewRoutine) => {
      try {
        const created = await createRoutine(toRoutineCreate(n));
        setRoutines((prev) => [...prev, toAppRoutine(created)]);
        // 퍼널 (#799) — 온보딩 미션은 스킵할 수 있어 미션 이벤트만으로는
        // 등록한 사람을 다 세지 못한다. 생성 자체를 여기서 센다.
        track('routine_create', { kind: 'routine' });
        return true;
      } catch {
        toast('루틴을 만들지 못했어요', 'error');
        return false;
      }
    },
    [toast],
  );

  const updateRoutine = useCallback(
    async (id: string, n: NewRoutine) => {
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
    },
    [findItem, toast],
  );

  const renameRoutine = useCallback(
    async (id: string, title: string) => {
      const item = findItem(id);
      if (!item) return;
      setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, title } : r)));
      try {
        if (item.kind === 'todo')
          await updateTodo(toServerItemId(id), toTodoUpdate(item, { title }));
        else await apiUpdateRoutine(toServerItemId(id), toRoutineUpdate(item, { title }));
        refreshCachedCalendarDays();
      } catch {
        setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, title: item.title } : r)));
        toast('수정에 실패했어요', 'error');
      }
    },
    [findItem, refreshCachedCalendarDays, toast],
  );

  /** 카테고리 이동 (#716, 롱프레스 드래그) — categoryId만 바꾸는 부분 수정. */
  const moveRoutineToCategory = useCallback(
    async (id: string, categoryId: string) => {
      // 빈 목적지(미분류)는 PUT에서 categoryId가 빠져 서버 unset이 안 된다
      // (#718 리뷰) — 화면 가드와 별개의 방어. 무카테고리화 경로는 없다.
      if (categoryId === '') return;
      const item = findItem(id);
      if (!item || item.category === categoryId) return;
      const prevCategory = item.category;
      setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, category: categoryId } : r)));
      try {
        if (item.kind === 'todo')
          await updateTodo(toServerItemId(id), toTodoUpdate(item, { category: categoryId }));
        else await apiUpdateRoutine(toServerItemId(id), toRoutineUpdate(item, { category: categoryId })); // prettier-ignore
        refreshCachedCalendarDays();
      } catch {
        setRoutines((prev) =>
          prev.map((r) => (r.id === id ? { ...r, category: prevCategory } : r)),
        );
        toast('카테고리 이동에 실패했어요', 'error');
      }
    },
    [findItem, refreshCachedCalendarDays, toast],
  );

  const updateRoutineTime = useCallback(
    async (id: string, alarmEnabled: boolean, time: string) => {
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
    },
    [findItem, refreshCachedCalendarDays, toast],
  );

  /** Change a todo's due date (메뉴 시트 → 날짜 바꾸기). */
  const updateTodoDueDate = useCallback(
    async (id: string, dueDate: string) => {
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
    },
    [findItem, refreshCachedCalendarDays, toast],
  );

  /**
   * 루틴의 그 날 몫 하나를 다른 날짜로 옮기기 (메뉴 → 날짜 바꾸기 on a
   * routine). The repeat schedule stays untouched; a one-off todo with the
   * routine's title lands on the picked date. The server has no
   * per-occurrence skip yet, so the original day's instance still shows.
   */
  const moveRoutineOccurrence = useCallback(
    async (id: string, dueDate: string) => {
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
    },
    [findItem, refreshCachedCalendarDays, toast],
  );

  const deleteRoutine = useCallback(
    async (id: string) => {
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
    },
    [findItem, refreshCachedCalendarDays, toast],
  );

  /** Persist the profile (PUT /me) — nickname + bio together, optimistic. */
  const saveProfile = useCallback(
    async (nick: string, newBio: string): Promise<boolean> => {
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
    },
    [nickname, bio, toast],
  );

  /** Create a category; returns the created meta (null on failure) so callers
   * can immediately file a routine under it (미션 → 루틴 연동). */
  const createRoutineCategory = useCallback(
    async (cat: RoutineCategoryMeta) => {
      try {
        const created = await createCategory(toCategoryCreate(cat, categories.length));
        const meta = toAppCategory(created, categories.length);
        setCategories((prev) => [...prev, meta]);
        // 달력(서버 날짜)은 allCategories로 메타를 해석하므로 같이 추가 —
        // 안 하면 새 카테고리 항목이 과거/미래 날짜에서 '기타'로 폴백 (#481).
        setAllCategories((prev) => [...prev, meta]);
        return meta;
      } catch {
        toast('카테고리를 만들지 못했어요', 'error');
        return null;
      }
    },
    [categories, toast],
  );

  /**
   * Find the linked house category — refreshing from the server first, since
   * another session may have created it (stale local state must not duplicate
   * it, #272) — creating it only when genuinely absent. Matches by the server
   * link id (houseId, #578) first; falls back to the name for not-yet-promoted
   * legacy categories.
   */
  const ensureCategory = useCallback(
    async (cat: RoutineCategoryMeta): Promise<RoutineCategoryMeta | null> => {
      const match = (list: RoutineCategoryMeta[]) =>
        (cat.houseId != null ? list.find((c) => c.houseId === cat.houseId) : undefined) ??
        list.find((c) => c.name === cat.name);
      try {
        const cats = await fetchCategories();
        const appCats = cats.map((c, i) => toAppCategory(c, i)).filter((c) => !c.deleted);
        setCategories(appCats);
        const existing = match(appCats);
        if (existing) return existing;
      } catch {
        // Offline lookup fallback: trust local state below.
        const existing = match(categories);
        if (existing) return existing;
      }
      return createRoutineCategory(cat);
    },
    [categories, createRoutineCategory],
  );

  /**
   * 이름 매칭 연동분 1회성 승격 (#578) — 서버에 링크 id를 심고 로컬 상태에도
   * 반영한다. 실패는 조용히 건너뛴다(조건 기반이라 다음 부팅에 재시도).
   */
  const linkRoutineMission = useCallback(
    async (id: string, missionId: number) => {
      const item = findItem(id);
      if (!item || item.kind === 'todo') return;
      try {
        await apiUpdateRoutine(
          toServerItemId(id),
          toRoutineUpdate(item, { linkedMissionId: missionId }),
        );
        setRoutines((prev) =>
          prev.map((r) => (r.id === id ? { ...r, linkedMissionId: missionId } : r)),
        );
      } catch {
        // Silent — 승격 실패는 이번 부팅에선 이름 매칭 없이 미연동으로 남는다.
      }
    },
    [findItem],
  );

  /** linkRoutineMission의 카테고리판 — houseId를 심는다 (#578). */
  const linkCategoryHouse = useCallback(
    async (id: string, houseId: number) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;
      try {
        const sortOrder = categories.findIndex((c) => c.id === id);
        await apiUpdateCategory(
          Number(id),
          toCategoryCreate({ ...cat, houseId }, sortOrder >= 0 ? sortOrder : undefined),
        );
        setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, houseId } : c)));
        setAllCategories((prev) => prev.map((c) => (c.id === id ? { ...c, houseId } : c)));
      } catch {
        // Silent — 다음 부팅에 재시도.
      }
    },
    [categories],
  );

  const updateRoutineCategory = useCallback(
    async (id: string, cat: RoutineCategoryMeta) => {
      const before = categories;
      const beforeAll = allCategories;
      // Keep the id and sort position; only name/emoji/visibility change.
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...cat, id } : c)));
      // 달력(서버 날짜)의 메타 소스도 동기화 — 안 하면 아이콘/이름/색 변경이
      // 달력 탭에 반영되지 않는다 (reorderCategories와 같은 규칙, #481).
      setAllCategories((prev) => prev.map((c) => (c.id === id ? { ...cat, id } : c)));
      try {
        const sortOrder = categories.findIndex((c) => c.id === id);
        await apiUpdateCategory(
          Number(id),
          toCategoryCreate(cat, sortOrder >= 0 ? sortOrder : undefined),
        );
      } catch {
        setCategories(before);
        setAllCategories(beforeAll);
        toast('카테고리 수정에 실패했어요', 'error');
      }
    },
    [categories, allCategories, toast],
  );

  /** Persist a new category order (ids top→bottom) — sortOrder = list index. */
  const reorderCategories = useCallback(
    async (orderedIds: string[]) => {
      const byId = new Map(categories.map((c) => [c.id, c]));
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((c): c is RoutineCategoryMeta => !!c);
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
    },
    [categories, allCategories, toast],
  );

  /**
   * 카테고리와 그 안의 루틴·투두를 통째로 삭제 (#338) — 집 삭제 시 연동
   * 카테고리 정리용. 개별 실패는 무시하고 끝까지 진행한 뒤 서버 상태로
   * 재동기화한다(집이 이미 사라진 뒤라 남겨둘 이유가 없다).
   */
  const deleteCategoryCascade = useCallback(
    async (categoryId: string) => {
      const items = routines.filter((r) => r.category === categoryId);
      setRoutines((prev) => prev.filter((r) => r.category !== categoryId));
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      for (const item of items) {
        try {
          if (item.kind === 'todo') await deleteTodo(toServerItemId(item.id));
          else await apiDeleteRoutine(toServerItemId(item.id));
        } catch {
          // 진행 — 지워지지 않은 항목은 reload가 되살린다.
        }
      }
      try {
        // 집 정리 캐스케이드는 기록을 남기는 UNASSIGN으로 마감한다 (#517).
        await apiDeleteCategory(Number(categoryId), 'UNASSIGN');
      } catch {
        // CATEGORY_IN_USE 등 — reload가 실제 상태를 복원한다.
      }
      refreshCachedCalendarDays();
      await reload();
    },
    [routines, refreshCachedCalendarDays, reload],
  );

  const deleteRoutineCategory = useCallback(
    async (id: string, mode: CategoryDeleteMode) => {
      // 서버는 "살아있는 루틴"이 있을 때만 삭제를 거부한다 (#517, 409
      // CATEGORY_IN_USE) — 투두는 mode가 처리(UNASSIGN=미분류 전환, PURGE=삭제).
      // 깜빡임 방지를 위해 클라에서도 같은 기준으로 먼저 거른다.
      if (routines.some((r) => r.category === id && r.kind !== 'todo')) {
        toast('카테고리에 루틴이 남아 있어 삭제할 수 없어요', 'error');
        return;
      }
      const before = { categories, routines };
      setCategories((prev) => prev.filter((c) => c.id !== id));
      // 화면도 서버 결과를 선반영 — UNASSIGN은 투두를 미분류로, PURGE는 제거.
      setRoutines((prev) =>
        mode === 'UNASSIGN'
          ? prev.map((r) => (r.category === id ? { ...r, category: undefined } : r))
          : prev.filter((r) => r.category !== id),
      );
      try {
        await apiDeleteCategory(Number(id), mode);
        await reload();
      } catch (err) {
        setCategories(before.categories);
        setRoutines(before.routines);
        const inUse = err instanceof ApiError && err.code === ErrorCode.CATEGORY_IN_USE;
        toast(
          inUse ? '카테고리에 루틴이 남아 있어 삭제할 수 없어요' : '카테고리 삭제에 실패했어요',
          'error',
        );
      }
    },
    [routines, categories, reload, toast],
  );

  return useMemo(
    () => ({
      routines,
      completions,
      categories,
      allCategories,
      calendarDays,
      loadCalendarDay,
      loadCalendarMonth,
      markedTodoDates,
      wallet,
      setWallet,
      nickname,
      bio,
      streak,
      loading,
      error,
      /** Re-run the full load cycle (used by the error state's 다시 시도). */
      retry: load,
      /** 조용한 전체 리페치 (#454 당겨서 새로고침) — 로딩 화면 없이 갱신. */
      reload,
      toggleCompletion,
      toggleCalendarItem,
      saveProfile,
      quickAddTodo,
      addRoutine,
      updateRoutine,
      renameRoutine,
      moveRoutineToCategory,
      updateRoutineTime,
      updateTodoDueDate,
      moveRoutineOccurrence,
      deleteRoutine,
      createRoutineCategory,
      ensureCategory,
      linkRoutineMission,
      linkCategoryHouse,
      updateRoutineCategory,
      deleteRoutineCategory,
      deleteCategoryCascade,
      reorderCategories,
    }),
    [
      routines,
      completions,
      categories,
      allCategories,
      calendarDays,
      loadCalendarDay,
      loadCalendarMonth,
      markedTodoDates,
      wallet,
      nickname,
      bio,
      streak,
      loading,
      error,
      load,
      reload,
      toggleCompletion,
      toggleCalendarItem,
      saveProfile,
      quickAddTodo,
      addRoutine,
      updateRoutine,
      renameRoutine,
      moveRoutineToCategory,
      updateRoutineTime,
      updateTodoDueDate,
      moveRoutineOccurrence,
      deleteRoutine,
      createRoutineCategory,
      ensureCategory,
      linkRoutineMission,
      linkCategoryHouse,
      updateRoutineCategory,
      deleteRoutineCategory,
      deleteCategoryCascade,
      reorderCategories,
    ],
  );
}
