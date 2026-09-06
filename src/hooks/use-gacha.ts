/** Category gacha catalogue and non-retrying, single-flight paid draws. */
import { useCallback, useMemo, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { drawGacha, fetchGachas, type GachaDrawCount } from '@/api';
import { type GachaMachine, toGachaMachine, toWallet } from '@/api/adapters';
import { getCategoryGachas } from '@/constants/gacha';
import type { DrawResult, GachaResponse } from '@/api/types';
import type { Wallet } from '@/constants/currency';
import { useLatestRef } from '@/hooks/use-stable-value';
import { track } from '@/lib/analytics';

export const GACHAS_KEY = ['gachas', 'categories'] as const;

const NO_GACHAS: GachaMachine[] = [];
const selectGachas = (list: GachaResponse[]) =>
  getCategoryGachas(list.filter((gacha) => gacha.active !== false).map(toGachaMachine));

export function useGacha(onWallet: (wallet: Wallet) => void) {
  const walletRef = useLatestRef(onWallet);
  // A synchronous lock also covers two taps before React renders isPending.
  const drawingRef = useRef(false);
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: GACHAS_KEY,
    queryFn: fetchGachas,
    select: selectGachas,
  });
  const { mutateAsync } = useMutation({
    mutationFn: ({ gachaId, count }: { gachaId: number; count: GachaDrawCount }) =>
      drawGacha(gachaId, count),
    // A timed-out spending request must never trigger an automatic second charge.
    retry: false,
  });

  const retry = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const draw = useCallback(
    async (gachaId: number, count: GachaDrawCount = 1): Promise<DrawResult[] | null> => {
      if (
        drawingRef.current ||
        !Number.isInteger(gachaId) ||
        gachaId <= 0 ||
        (count !== 1 && count !== 6)
      ) {
        return null;
      }
      drawingRef.current = true;
      try {
        const response = await mutateAsync({ gachaId, count });
        if (response.wallets?.length) walletRef.current(toWallet(response.wallets));
        track('gacha_draw', { gachaId, count });
        return response.results ?? [];
      } catch {
        return null;
      } finally {
        drawingRef.current = false;
      }
    },
    [mutateAsync, walletRef],
  );

  const gachas = data ?? NO_GACHAS;
  const loading = isPending || (isFetching && !data);
  const error = isError && !isFetching;

  return useMemo(
    () => ({ gachas, loading, error, retry, draw }),
    [gachas, loading, error, retry, draw],
  );
}
