import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import { getSessionUserId } from '@/api/auth';
import {
  fetchShopListing,
  fetchShopListings,
  purchaseShopListing,
  sellShopListing,
  updateShopListing,
} from '@/api/market-shop';
import { ApiError } from '@/api/http';
import { useWallet } from '@/hooks/use-wallet';
import { queryKeys } from '@/lib/query-keys';
import { newRequestId } from '@/utils/uuid';

export function useMarketShop(enabled: boolean, mine: boolean, selectedId: number | null) {
  const userId = getSessionUserId();
  const qc = useQueryClient();
  const { refreshWallet } = useWallet();
  const list = useInfiniteQuery({
    queryKey: ['market-shop', userId, 'list', mine],
    queryFn: ({ pageParam }) => fetchShopListings(pageParam, mine),
    initialPageParam: 0,
    getNextPageParam: (last, _pages, previous) => (last.hasNext ? previous + 1 : undefined),
    enabled,
  });
  const detail = useQuery({
    queryKey: ['market-shop', userId, 'detail', selectedId],
    queryFn: () => fetchShopListing(selectedId!),
    enabled: enabled && selectedId != null,
  });
  const { mutateAsync: buyAsync } = useMutation({
    mutationFn: ({ id, price, requestId }: { id: number; price: number; requestId: string }) =>
      purchaseShopListing(id, price, requestId),
  });
  const { mutateAsync: sellAsync } = useMutation({
    mutationFn: ({ userItemId, price }: { userItemId: number; price: number }) =>
      sellShopListing(userItemId, price),
  });
  const { mutateAsync: updateAsync } = useMutation({
    mutationFn: ({ id, price, selling }: { id: number; price: number; selling: boolean }) =>
      updateShopListing(id, price, selling),
  });
  const unsettled = useRef(new Map<string, string>());
  const invalidate = useCallback(async () => {
    await Promise.allSettled([
      qc.invalidateQueries({ queryKey: ['market-shop', userId] }),
      qc.invalidateQueries({ queryKey: queryKeys.myItems.all }),
      qc.invalidateQueries({ queryKey: queryKeys.myRoom.all }),
      qc.invalidateQueries({ queryKey: queryKeys.walletHistory(userId) }),
      refreshWallet(),
    ]);
  }, [qc, userId, refreshWallet]);
  const buy = useCallback(
    async (id: number, price: number) => {
      const key = `${userId}:${id}:${price}`;
      const requestId = unsettled.current.get(key) ?? newRequestId();
      unsettled.current.set(key, requestId);
      try {
        const result = await buyAsync({ id, price, requestId });
        unsettled.current.delete(key);
        await invalidate();
        return result;
      } catch (error) {
        if (error instanceof ApiError && error.status < 500) unsettled.current.delete(key);
        await invalidate();
        throw error;
      }
    },
    [userId, buyAsync, invalidate],
  );
  const sell = useCallback(
    async (userItemId: number, price: number) => {
      const result = await sellAsync({ userItemId, price });
      await invalidate();
      return result;
    },
    [sellAsync, invalidate],
  );
  const update = useCallback(
    async (id: number, price: number, selling: boolean) => {
      const result = await updateAsync({ id, price, selling });
      await invalidate();
      return result;
    },
    [updateAsync, invalidate],
  );
  const refetchList = list.refetch,
    refetchDetail = detail.refetch;
  const fetchNextPage = list.fetchNextPage,
    hasNextPage = list.hasNextPage;
  const fetchingNextPage = list.isFetchingNextPage;
  const refresh = useCallback(async () => {
    await refetchList();
  }, [refetchList]);
  const refreshDetail = useCallback(async () => {
    await refetchDetail();
  }, [refetchDetail]);
  const loadMore = useCallback(() => {
    if (hasNextPage && !fetchingNextPage) void fetchNextPage();
  }, [hasNextPage, fetchingNextPage, fetchNextPage]);
  const listings = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  return useMemo(
    () => ({
      listings,
      listing: detail.data ?? null,
      loading: enabled && list.isPending,
      error: list.isError,
      detailLoading: enabled && selectedId != null && detail.isPending,
      detailError: detail.isError,
      hasNext: !!list.hasNextPage,
      loadingMore: list.isFetchingNextPage,
      buy,
      sell,
      update,
      refresh,
      refreshDetail,
      loadMore,
    }),
    [
      listings,
      detail.data,
      enabled,
      selectedId,
      list.isPending,
      list.isError,
      detail.isPending,
      detail.isError,
      list.hasNextPage,
      list.isFetchingNextPage,
      buy,
      sell,
      update,
      refresh,
      refreshDetail,
      loadMore,
    ],
  );
}
