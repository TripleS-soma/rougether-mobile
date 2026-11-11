import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getSessionUserId } from '@/api';
import { acknowledgeLoginGift, fetchLoginGifts, type LoginGiftList } from '@/api/login-gifts';
import { useWallet } from '@/hooks/use-wallet';
import { queryKeys } from '@/lib/query-keys';

export const PEPERO_GIFT_CODE = 'PEPERO_DAY_20261111';
// The approved success copy is specific to this event's 111-coin reward.
export const PEPERO_COIN_AMOUNT = 111;
const MAX_RECEIPT_POLLS = 12;
export const PEPERO_START = Date.parse('2026-11-11T00:00:00+09:00');
export const PEPERO_END = Date.parse('2026-11-12T00:00:00+09:00');
export const isPeperoDay = (now: number) => now >= PEPERO_START && now < PEPERO_END;

/** A receipt can arrive after the first request because the server grants asynchronously. */
export function usePeperoGift({ enabled }: { enabled: boolean }) {
  const userId = getSessionUserId();
  const qc = useQueryClient();
  const { refreshWallet } = useWallet();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const focus = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => focus.remove();
  }, []);
  useEffect(() => {
    const boundary = now < PEPERO_START ? PEPERO_START : PEPERO_END;
    const delay = boundary - Date.now();
    if (delay < 0) {
      if (now < PEPERO_END) setNow(Date.now());
      return;
    }
    if (delay > 2_147_483_647) return;
    const timer = setTimeout(() => setNow(Date.now()), delay + 1);
    return () => clearTimeout(timer);
  }, [now]);
  const inWindow = isPeperoDay(now);
  const receipts = useQuery({
    queryKey: queryKeys.loginGifts(userId),
    queryFn: async () => {
      if (userId == null || getSessionUserId() !== userId) return { gifts: [] };
      const result = await fetchLoginGifts();
      return getSessionUserId() === userId && Array.isArray(result?.gifts) ? result : { gifts: [] };
    },
    enabled: enabled && inWindow && userId != null,
    staleTime: 0,
    retry: 1,
    refetchInterval: (query) =>
      query.state.dataUpdateCount + query.state.errorUpdateCount <= MAX_RECEIPT_POLLS &&
      !query.state.data?.gifts?.some((gift) => gift?.code === PEPERO_GIFT_CODE && gift.grantedAt)
        ? 5_000
        : false,
  });
  const gift =
    inWindow && getSessionUserId() === userId
      ? (receipts.data?.gifts?.find(
          (entry) =>
            entry?.code === PEPERO_GIFT_CODE &&
            entry.grantedAt != null &&
            entry.coinAmount === PEPERO_COIN_AMOUNT &&
            entry.reward?.userItemId != null,
        ) ?? null)
      : null;
  const synced = useRef<string | null>(null);
  useEffect(() => {
    const key = gift ? `${userId}:${gift.participationId}` : null;
    if (!gift || key === synced.current || getSessionUserId() !== userId) return;
    synced.current = key;
    void refreshWallet();
    void qc.invalidateQueries({ queryKey: queryKeys.myItems.byUser(userId) });
    void qc.invalidateQueries({ queryKey: queryKeys.walletHistory(userId) });
  }, [gift, userId, qc, refreshWallet]);
  const { mutateAsync, isPending: dismissing } = useMutation({
    mutationFn: acknowledgeLoginGift,
    retry: false,
  });
  const lock = useRef(false);
  const acknowledge = useCallback(async () => {
    if (!gift || lock.current || getSessionUserId() !== userId) return false;
    lock.current = true;
    try {
      await mutateAsync(gift.participationId);
      if (getSessionUserId() !== userId) return false;
      qc.setQueryData<LoginGiftList>(queryKeys.loginGifts(userId), (old) =>
        old
          ? {
              gifts: old.gifts.map((entry) =>
                entry.participationId === gift.participationId
                  ? { ...entry, acknowledgedAt: new Date().toISOString() }
                  : entry,
              ),
            }
          : old,
      );
      return true;
    } catch {
      return false;
    } finally {
      lock.current = false;
    }
  }, [gift, mutateAsync, qc, userId]);
  return useMemo(
    () => ({ gift, inWindow, loading: receipts.isPending, dismissing, acknowledge }),
    [gift, inWindow, receipts.isPending, dismissing, acknowledge],
  );
}
