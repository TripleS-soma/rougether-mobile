/**
 * Gacha machines + draw, backed by the API. Loads the machine list on mount and
 * exposes `draw(gachaId)`, which spends via the API and returns the drawn
 * results. The API applies the dupe→diamond conversion server-side and returns the
 * updated wallet balances, which we forward via `onWallet`.
 */
import { useCallback, useEffect, useState } from 'react';

import { drawGacha, fetchGachas, type GachaDrawCount } from '@/api';
import { type GachaMachine, toGachaMachine, toWallet } from '@/api/adapters';
import type { DrawResult } from '@/api/types';
import type { Wallet } from '@/constants/currency';
import { track } from '@/lib/analytics';

export function useGacha(onWallet: (wallet: Wallet) => void) {
  const [gachas, setGachas] = useState<GachaMachine[]>([]);
  const [loading, setLoading] = useState(true);
  // 로드 실패 (#549) — 화면이 빈 상태('뽑기 없음')와 구분해 다시 시도를 보여준다.
  const [error, setError] = useState(false);

  /** 머신 목록 로드 사이클 (스피너 → 데이터 | 에러) — 초기 로드·재시도 공용. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const list = await fetchGachas();
      setGachas(list.map((g, i) => toGachaMachine(g, i)));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Draw once or use the 5+1 option (the server accepts count 1 or 6). */
  const draw = async (gachaId: number, count: GachaDrawCount = 1): Promise<DrawResult[] | null> => {
    try {
      const res = await drawGacha(gachaId, count);
      if (res.wallets?.length) onWallet(toWallet(res.wallets));
      track('gacha_draw', { gachaId, count });
      return res.results ?? [];
    } catch {
      return null;
    }
  };

  return { gachas, loading, error, retry: load, draw };
}
