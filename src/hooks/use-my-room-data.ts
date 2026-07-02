/**
 * My-room data, backed by the Rougether User API. Fetches categories, routines,
 * todos, today's completion and wallet on mount, and exposes the same callback
 * shapes the screens already use — so the app shell wires straight through.
 *
 * Note: the API has no "completion log for an arbitrary date" endpoint, so only
 * *today's* completion is server-sourced; toggles on other dates (달력 tab) are
 * kept client-side and sent to the API, but won't survive a reload.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  completeRoutine,
  completeTodo,
  createCategory,
  createRoutine,
  createTodo,
  deleteCategory as apiDeleteCategory,
  deleteRoutine as apiDeleteRoutine,
  deleteTodo,
  fetchCategories,
  fetchRoutines,
  fetchToday,
  fetchTodos,
  fetchWallets,
  uncompleteRoutine,
  uncompleteTodo,
  updateRoutine as apiUpdateRoutine,
  updateTodo,
} from '@/api';
import {
  toAppCategory,
  toAppRoutine,
  toAppTodo,
  toCategoryCreate,
  toRoutineCreate,
  toRoutineUpdate,
  toTodoCreate,
  toTodoUpdate,
  toWallet,
  todayCompletions,
} from '@/api/adapters';
import { DEFAULT_WALLET, type Wallet } from '@/constants/currency';
import type { NewRoutine, Routine, RoutineCategoryMeta } from '@/constants/routines';
import { todayIso } from '@/utils/datetime';

export function useMyRoomData() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [completions, setCompletions] = useState<Record<string, string[]>>({});
  const [categories, setCategories] = useState<RoutineCategoryMeta[]>([]);
  const [wallet, setWallet] = useState<Wallet>(DEFAULT_WALLET);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [cats, rts, tds, today, wals] = await Promise.all([
      fetchCategories(),
      fetchRoutines(),
      fetchTodos(),
      fetchToday(),
      fetchWallets(),
    ]);
    setCategories(cats.map((c, i) => toAppCategory(c, i)));
    setRoutines([...rts.map(toAppRoutine), ...tds.map(toAppTodo)]);
    setCompletions(todayCompletions(today, todayIso()));
    setWallet(toWallet(wals));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reload()
      .catch((e) => active && setError(e instanceof Error ? e.message : 'load failed'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reload]);

  const refreshWallet = useCallback(async () => {
    try {
      setWallet(toWallet(await fetchWallets()));
    } catch {
      // Non-fatal; keep the last known balance.
    }
  }, []);

  const findItem = (id: string) => routines.find((r) => r.id === id);

  const toggleCompletion = async (id: string, date: string) => {
    const item = findItem(id);
    const wasDone = (completions[id] ?? []).includes(date);
    // Optimistic update; revert on failure.
    setCompletions((prev) => {
      const dates = prev[id] ?? [];
      return { ...prev, [id]: wasDone ? dates.filter((d) => d !== date) : [...dates, date] };
    });
    try {
      const numId = Number(id);
      if (item?.kind === 'todo') {
        await (wasDone ? uncompleteTodo(numId) : completeTodo(numId));
      } else {
        await (wasDone ? uncompleteRoutine(numId, date) : completeRoutine(numId, date));
      }
      await refreshWallet();
    } catch {
      setCompletions((prev) => {
        const dates = prev[id] ?? [];
        return { ...prev, [id]: wasDone ? [...dates, date] : dates.filter((d) => d !== date) };
      });
    }
  };

  const quickAddTodo = async (category: string, title: string, dueDate: string) => {
    try {
      const created = await createTodo(toTodoCreate(category, title, dueDate));
      setRoutines((prev) => [...prev, toAppTodo(created)]);
    } catch {
      // ignore; nothing added
    }
  };

  const addRoutine = async (n: NewRoutine) => {
    try {
      const created = await createRoutine(toRoutineCreate(n));
      setRoutines((prev) => [...prev, toAppRoutine(created)]);
    } catch {
      // ignore
    }
  };

  const updateRoutine = async (id: string, n: NewRoutine) => {
    const item = findItem(id);
    if (!item) return;
    try {
      if (item.kind === 'todo') {
        const updated = await updateTodo(Number(id), toTodoUpdate(item, n));
        setRoutines((prev) => prev.map((r) => (r.id === id ? toAppTodo(updated) : r)));
      } else {
        const updated = await apiUpdateRoutine(Number(id), toRoutineUpdate(item, n));
        setRoutines((prev) => prev.map((r) => (r.id === id ? toAppRoutine(updated) : r)));
      }
    } catch {
      // ignore
    }
  };

  const renameRoutine = async (id: string, title: string) => {
    const item = findItem(id);
    if (!item) return;
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, title } : r)));
    try {
      if (item.kind === 'todo') await updateTodo(Number(id), toTodoUpdate(item, { title }));
      else await apiUpdateRoutine(Number(id), toRoutineUpdate(item, { title }));
    } catch {
      setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, title: item.title } : r)));
    }
  };

  const updateRoutineTime = async (id: string, alarmEnabled: boolean, time: string) => {
    const item = findItem(id);
    if (!item || item.kind === 'todo') return;
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, alarmEnabled, time } : r)));
    try {
      await apiUpdateRoutine(Number(id), toRoutineUpdate(item, { alarmEnabled, time }));
    } catch {
      setRoutines((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, alarmEnabled: item.alarmEnabled, time: item.time } : r,
        ),
      );
    }
  };

  const deleteRoutine = async (id: string) => {
    const item = findItem(id);
    if (!item) return;
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    try {
      if (item.kind === 'todo') await deleteTodo(Number(id));
      else await apiDeleteRoutine(Number(id));
    } catch {
      setRoutines((prev) => [...prev, item]);
    }
  };

  const createRoutineCategory = async (cat: RoutineCategoryMeta) => {
    try {
      const created = await createCategory(toCategoryCreate(cat, categories.length));
      setCategories((prev) => [...prev, toAppCategory(created, prev.length)]);
    } catch {
      // ignore
    }
  };

  const deleteRoutineCategory = async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    try {
      await apiDeleteCategory(Number(id));
      // Server may reassign the category's routines; refetch to stay in sync.
      const rts = await fetchRoutines();
      const tds = await fetchTodos();
      setRoutines([...rts.map(toAppRoutine), ...tds.map(toAppTodo)]);
    } catch {
      // ignore; category already removed locally
    }
  };

  return {
    routines,
    completions,
    categories,
    wallet,
    setWallet,
    loading,
    error,
    reload,
    toggleCompletion,
    quickAddTodo,
    addRoutine,
    updateRoutine,
    renameRoutine,
    updateRoutineTime,
    deleteRoutine,
    createRoutineCategory,
    deleteRoutineCategory,
  };
}
