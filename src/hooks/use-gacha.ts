/**
 * Gacha machines + draw, backed by the API. Loads the machine list on mount and
 * exposes `draw(gachaId)`, which spends via the API and returns the drawn
 * results. The API applies the dupe→dia conversion server-side and returns the
 * updated wallet balances, which we forward via `onWallet`.
 */
import { useEffect, useState } from 'react';

import {
  drawGacha,
  fetchGachaRewards,
  fetchGachas,
  type GachaDrawCount,
  type GachaRewardPreview,
} from '@/api';
import { type GachaMachine, toGachaMachine, toWallet } from '@/api/adapters';
import type { DrawResult } from '@/api/types';
import type { Wallet } from '@/constants/currency';

export function useGacha(onWallet: (wallet: Wallet) => void) {
  const [gachas, setGachas] = useState<GachaMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewardsByGachaId, setRewardsByGachaId] = useState<Record<number, GachaRewardPreview[]>>(
    {},
  );
  const [rewardsLoading, setRewardsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchGachas()
      .then(async (list) => {
        if (!active) return;
        setGachas(list.map((g, i) => toGachaMachine(g, i)));
        setLoading(false);

        const rewards = await Promise.all(
          list.map(async (g) => {
            const gachaId = g.gachaId;
            if (gachaId == null) return null;
            try {
              return [gachaId, await fetchGachaRewards(gachaId)] as const;
            } catch {
              // A single unavailable preview must not hide the other machines.
              return [gachaId, []] as const;
            }
          }),
        );
        if (active) {
          setRewardsByGachaId(
            Object.fromEntries(rewards.filter((entry) => entry != null)) as Record<
              number,
              GachaRewardPreview[]
            >,
          );
        }
      })
      .catch(() => {
        // Non-fatal; the screen shows an empty state.
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRewardsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  /** Draw once or use the 5+1 option (the server accepts count 1 or 6). */
  const draw = async (gachaId: number, count: GachaDrawCount = 1): Promise<DrawResult[] | null> => {
    try {
      const res = await drawGacha(gachaId, count);
      if (res.wallets?.length) onWallet(toWallet(res.wallets));
      return res.results ?? [];
    } catch {
      return null;
    }
  };

  return { gachas, loading, rewardsByGachaId, rewardsLoading, draw };
}
