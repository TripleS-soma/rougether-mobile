import { useCallback, useMemo } from 'react';
import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import { fetchWalletHistories } from '@/api';
import { getSessionUserId } from '@/api/auth';
import { toWalletHistoryEntry, type WalletHistoryEntry } from '@/api/adapters';
import type { Page } from '@/api/client';
import type { WalletHistoryResponse } from '@/api/types';
import { useLatestRef } from '@/hooks/use-stable-value';
import { queryKeys } from '@/lib/query-keys';

const PAGE_SIZE = 20;

const NO_ENTRIES: WalletHistoryEntry[] = [];

type HistoryPages = InfiniteData<Page<WalletHistoryResponse>, number>;

/** 페이지들을 한 목록으로 — 모듈 스코프에 두어 react-query가 결과를 메모한다. */
const selectEntries = (data: HistoryPages): WalletHistoryEntry[] =>
  data.pages.flatMap((page) =>
    page.items.map(toWalletHistoryEntry).filter((e): e is WalletHistoryEntry => e !== null),
  );

/**
 * 재화 증감 이력 (#734, GET /me/wallets/histories) — 최신순 페이지.
 * 완료 취소 시 서버가 해당 적립 이력을 지우므로, 시트를 열 때마다 load()로
 * 1페이지부터 다시 읽는다(스테일 방지). loadMore는 더보기 페이지 이어붙임.
 *
 * react-query `useInfiniteQuery`로 이관 (#1027). 쿼리는 지연(enabled: false) —
 * 셸에 상주하는 훅이라 시트가 열릴 때의 `load()`가 첫 요청이다. `refetch`는
 * 받아 둔 페이지를 전부 다시 받으므로, load()는 캐시를 1페이지로 잘라 낸 뒤
 * 재조회해 요청 한 번으로 끝낸다.
 */
export function useWalletHistory() {
  const qc = useQueryClient();
  // 키는 userId로 메모 — 매 렌더 새 배열이면 load의 참조가 흔들린다 (#539).
  const userId = getSessionUserId();
  const queryKey = useMemo(() => queryKeys.walletHistory(userId), [userId]);

  const { data, isError, isFetching, isFetchNextPageError, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery({
      queryKey,
      queryFn: ({ pageParam }) => fetchWalletHistories(pageParam, PAGE_SIZE),
      initialPageParam: 0,
      // 다음 페이지 여부는 apiGetPage가 서버의 page·size·totalElements로 계산한다.
      getNextPageParam: (last, _pages, lastPageParam) =>
        last.hasNext ? lastPageParam + 1 : undefined,
      select: selectEntries,
      enabled: false,
    });

  const load = useCallback(async () => {
    qc.setQueryData<HistoryPages>(queryKey, (prev) =>
      prev && prev.pages.length > 1
        ? { pages: prev.pages.slice(0, 1), pageParams: prev.pageParams.slice(0, 1) }
        : prev,
    );
    await refetch();
  }, [qc, queryKey, refetch]);

  // 더보기 중복 탭 가드 — 최신값 ref로 읽어 loadMore 참조를 고정한다 (#539).
  const busyRef = useLatestRef(isFetching);
  const hasNextRef = useLatestRef(hasNextPage);
  const loadMore = useCallback(() => {
    if (busyRef.current || !hasNextRef.current) return;
    void fetchNextPage().catch(() => {
      // 더보기 실패는 기존 목록을 유지한 채 조용히 접는다 — 아래 error 계산 참고.
    });
  }, [busyRef, fetchNextPage, hasNextRef]);

  const entries = data ?? NO_ENTRIES;
  const loading = isFetching;
  // 첫 페이지(재)조회 실패만 에러 상태로(시트가 재시도 노출). 더보기 실패는 제외.
  const error = isError && !isFetching && !isFetchNextPageError;
  const hasNext = hasNextPage;

  return useMemo(
    () => ({ entries, loading, error, hasNext, load, loadMore }),
    [entries, loading, error, hasNext, load, loadMore],
  );
}
