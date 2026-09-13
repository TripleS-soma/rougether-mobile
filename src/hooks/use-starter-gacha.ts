import { useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSessionUserId } from '@/api';
import { drawStarterGacha, fetchStarterGacha } from '@/api/starter-gacha';
import { queryKeys } from '@/lib/query-keys';
import type { DrawResult } from '@/api/types';
import { useLatestRef } from '@/hooks/use-stable-value';

export function useStarterGacha(enabled: boolean) {
  const userId = getSessionUserId();
  const key = queryKeys.starterGacha(userId);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: key, queryFn: fetchStarterGacha, enabled, retry: false });
  const latest = useLatestRef(query.data);
  const busy = useRef(false);
  const { mutateAsync } = useMutation({ mutationFn: drawStarterGacha, retry: false });
  const { refetch } = query;
  const draw = useCallback(async (): Promise<DrawResult[] | null> => {
    if (busy.current || !enabled || latest.current?.state === 'CLOSED') return null;
    // Lost response / app restart: show the previously granted result without another POST.
    if (latest.current?.state === 'CLAIMED')
      return latest.current.reward ? [latest.current.reward] : null;
    if (latest.current?.state !== 'PENDING') return null;
    busy.current = true;
    try {
      const response = await mutateAsync();
      await qc.invalidateQueries({ queryKey: queryKeys.myItems.byUser(userId) });
      await refetch();
      return response.results ?? [];
    } catch {
      const recovered = await refetch();
      if (recovered.data?.state === 'CLAIMED' && recovered.data.reward) {
        await qc.invalidateQueries({ queryKey: queryKeys.myItems.byUser(userId) });
        return [recovered.data.reward];
      }
      return null;
    } finally {
      busy.current = false;
    }
  }, [enabled, latest, mutateAsync, qc, refetch, userId]);
  const retry = useCallback(async () => {
    await refetch();
  }, [refetch]);
  return { state: query.data, loading: query.isPending, error: query.isError, draw, retry };
}
