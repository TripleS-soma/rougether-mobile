import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { createRoutine, fetchCategories, fetchRoutines, getSessionUserId } from '@/api';
import type { StarterRoutine } from '@/constants/starter-routines';
import { track } from '@/lib/analytics';

export function useStarterRoutine(userId: number | undefined) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = useCallback(() => mounted.current && getSessionUserId() === userId, [userId]);
  const routines = useQuery({
    queryKey: ['starter-routine', userId],
    queryFn: () => fetchRoutines(),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const { mutateAsync, isPending } = useMutation({
    retry: false,
    mutationFn: async (template: StarterRoutine) => {
      // Read before every explicit attempt, including after a lost POST response.
      const existing = await fetchRoutines();
      if (!current()) return null;
      if (existing.length > 0) return 'existing' as const;
      const categories = await fetchCategories().catch(() => []);
      if (!current()) return null;
      const category = categories.find(
        (item) => !item.deleted && item.houseId == null && item.name === template.category,
      );
      const created = await createRoutine({
        title: template.title,
        categoryId: category?.id,
        authType: 'CHECK',
        repeatType: 'DAILY',
        // Server defaults startsOn to today in KST. No device date or alarm time.
      });
      if (created.id == null) throw new Error('Missing routine id');
      if (!current()) return null;
      track('routine_create', { kind: 'routine', source: 'onboarding', template_id: template.id });
      return 'created' as const;
    },
  });

  const start = useCallback(
    async (template: StarterRoutine) => {
      if (lock.current || !current()) return null;
      lock.current = true;
      setSaveError(null);
      try {
        return await mutateAsync(template);
      } catch {
        if (current()) {
          setSaveError('루틴 저장을 확인하지 못했어요. 다시 확인해 주세요.');
          setNeedsConfirmation(true);
          track('starter_routine_failed', { template_id: template.id });
        }
        return null;
      } finally {
        lock.current = false;
      }
    },
    [current, mutateAsync],
  );

  const refetch = routines.refetch;
  const reload = useCallback(async () => {
    const result = await refetch();
    if (!current() || result.isError) return;
    setSaveError(null);
    setNeedsConfirmation(false);
  }, [current, refetch]);

  const existing = routines.isSuccess && routines.data.length > 0;
  const loading = routines.isFetching;
  const error =
    saveError ??
    (routines.isError ? '내 루틴을 불러오지 못했어요. 연결 후 다시 확인해 주세요.' : null);
  const needsReload = needsConfirmation || routines.isError;
  return useMemo(
    () => ({
      existing,
      loading,
      saving: isPending,
      error,
      needsReload,
      start,
      reload,
    }),
    [existing, loading, isPending, error, needsReload, start, reload],
  );
}
