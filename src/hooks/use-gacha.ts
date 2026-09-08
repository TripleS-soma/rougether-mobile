/** Category gacha catalogue and non-retrying, single-flight paid draws. */
import { useCallback, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { drawGacha, fetchGachas, type GachaDrawCount } from '@/api';
import { queryKeys } from '@/lib/query-keys';
import { type GachaMachine, toGachaMachine, toWallet } from '@/api/adapters';
import { getCategoryGachas } from '@/constants/gacha';
import type { DrawResult, GachaResponse } from '@/api/types';
import type { Wallet } from '@/constants/currency';
import { useLatestRef } from '@/hooks/use-stable-value';
import { track } from '@/lib/analytics';

const NO_GACHAS: GachaMachine[] = [];
const selectGachas = (list: GachaResponse[]) =>
  getCategoryGachas(list.filter((gacha) => gacha.active !== false).map(toGachaMachine));

export function useGacha(onWallet: (wallet: Wallet) => void) {
  const qc = useQueryClient();
  const walletRef = useLatestRef(onWallet);
  // A synchronous lock also covers two taps before React renders isPending.
  const drawingRef = useRef(false);
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: queryKeys.gachas,
    queryFn: fetchGachas,
    select: selectGachas,
  });
  const { mutateAsync } = useMutation({
    mutationFn: ({ gachaId, count }: { gachaId: number; count: GachaDrawCount }) =>
      drawGacha(gachaId, count),
    // A timed-out spending request must never trigger an automatic second charge.
    retry: false,
    // 뽑은 보상은 인벤토리·보유 캐릭터로 들어간다 — 셸이 손으로 재조회하던
    // 것을 무효화로 (#1027). 방 꾸미기가 보유중으로 보이고 배치 저장이
    // userItemId를 알며, 뽑은 캐릭터가 교체 피커에 뜬다. 중복이라 재화로
    // 바뀐(converted) 보상은 인벤토리에 안 들어가니 건너뛴다.
    onSuccess: (response) => {
      const results = response.results ?? [];
      if (results.some((r) => r.itemId != null && !r.converted))
        void qc.invalidateQueries({ queryKey: queryKeys.myItems.all });
      if (results.some((r) => r.characterId != null && !r.converted))
        void qc.invalidateQueries({ queryKey: queryKeys.myCharacters.all });
    },
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
