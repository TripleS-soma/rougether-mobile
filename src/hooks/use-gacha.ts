/**
 * Gacha machines + draw, backed by the API. Loads the machine list on mount and
 * exposes `draw(gachaId)`, which spends via the API and returns the drawn
 * results. The API applies the dupe→dia conversion server-side and returns the
 * updated wallet balances, which we forward via `onWallet`.
 */
import { useEffect, useState } from 'react';

import { drawGacha, fetchGachas } from '@/api';
import { type GachaMachine, toGachaMachine, toWallet } from '@/api/adapters';
import type { DrawResult } from '@/api/types';
import type { Wallet } from '@/constants/currency';

export function useGacha(onWallet: (wallet: Wallet) => void) {
  const [gachas, setGachas] = useState<GachaMachine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchGachas()
      .then((list) => active && setGachas(list.map((g, i) => toGachaMachine(g, i))))
      .catch(() => {
        // Non-fatal; the screen shows an empty state.
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const draw = async (gachaId: number): Promise<DrawResult[] | null> => {
    try {
      const res = await drawGacha(gachaId, 1);
      if (res.wallets?.length) onWallet(toWallet(res.wallets));
      return res.results ?? [];
    } catch {
      return null;
    }
  };

  return { gachas, loading, draw };
}
