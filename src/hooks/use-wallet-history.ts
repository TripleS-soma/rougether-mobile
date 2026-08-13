import { useCallback, useRef, useState } from 'react';

import { fetchWalletHistories } from '@/api';
import { toWalletHistoryEntry, type WalletHistoryEntry } from '@/api/adapters';

const PAGE_SIZE = 20;

/**
 * 재화 증감 이력 (#734, GET /me/wallets/histories) — 최신순 페이지.
 * 완료 취소 시 서버가 해당 적립 이력을 지우므로, 시트를 열 때마다 load()로
 * 1페이지부터 다시 읽는다(스테일 방지). loadMore는 더보기 페이지 이어붙임.
 */
export function useWalletHistory() {
  const [entries, setEntries] = useState<WalletHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const pageRef = useRef(0);
  const seqRef = useRef(0);

  const fetchPage = useCallback(async (page: number, append: boolean) => {
    const seq = ++seqRef.current;
    setLoading(true);
    if (!append) setError(false);
    try {
      const res = await fetchWalletHistories(page, PAGE_SIZE);
      if (seq !== seqRef.current) return;
      const items = (res.items ?? [])
        .map(toWalletHistoryEntry)
        .filter((e): e is WalletHistoryEntry => e !== null);
      setEntries((prev) => (append ? [...prev, ...items] : items));
      pageRef.current = page;
      const total = res.totalElements ?? 0;
      setHasNext((page + 1) * PAGE_SIZE < total);
    } catch {
      if (seq !== seqRef.current) return;
      // 첫 페이지 실패는 에러 상태로(시트가 재시도 노출), 더보기 실패는
      // 기존 목록을 유지한 채 조용히 접는다.
      if (!append) setError(true);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  const load = useCallback(() => fetchPage(0, false), [fetchPage]);
  const loadMore = useCallback(() => {
    if (!loading) void fetchPage(pageRef.current + 1, true);
  }, [fetchPage, loading]);

  return { entries, loading, error, hasNext, load, loadMore };
}
