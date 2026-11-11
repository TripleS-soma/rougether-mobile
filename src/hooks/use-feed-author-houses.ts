import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

import { getSessionUserId } from '@/api/auth';
import {
  fetchFeedAuthorHouses,
  joinFeedAuthorHouse,
  type FeedAuthorHouse,
} from '@/api/feed-houses';
import { ApiError } from '@/api/http';
import { useLatestRef } from '@/hooks/use-stable-value';
import { i18n } from '@/i18n';
import { queryKeys } from '@/lib/query-keys';

const NO_HOUSES: FeedAuthorHouse[] = [];

export function useFeedAuthorHouses(
  postId: number | null,
  enabled: boolean,
  onError: (message: string) => void,
) {
  const userId = getSessionUserId();
  const client = useQueryClient();
  const errorRef = useLatestRef(onError);
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: queryKeys.feed.authorHouses(userId, postId),
    queryFn: () => fetchFeedAuthorHouses(postId!),
    enabled: enabled && postId != null && userId != null,
    staleTime: 0,
    retry: false,
  });
  const { mutateAsync } = useMutation({
    mutationFn: ({ post, house }: { post: number; house: number }) =>
      joinFeedAuthorHouse(post, house),
    retry: false,
  });
  const busy = useRef(false);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const refresh = useCallback(() => void refetch(), [refetch]);
  const join = useCallback(
    async (houseId: number): Promise<'JOINED' | 'PENDING' | null> => {
      if (busy.current || postId == null || userId == null) return null;
      busy.current = true;
      setJoiningId(houseId);
      let result: 'JOINED' | 'PENDING';
      try {
        const response = await mutateAsync({ post: postId, house: houseId });
        result = response.pendingApproval ? 'PENDING' : 'JOINED';
      } catch (error) {
        if (error instanceof ApiError && error.code === 'HOUSE_ALREADY_MEMBER') {
          result = 'JOINED';
        } else {
          if (getSessionUserId() === userId) {
            const code = error instanceof ApiError ? error.code : undefined;
            const key = `feed.house.error.${code}`;
            errorRef.current(i18n.exists(key) ? i18n.t(key) : i18n.t('feed.house.error.generic'));
            void client.invalidateQueries({ queryKey: queryKeys.feed.authorHousesAll(userId) });
          }
          busy.current = false;
          setJoiningId(null);
          return null;
        }
      }
      try {
        if (getSessionUserId() !== userId) return null;
        await Promise.all([
          client.invalidateQueries({ queryKey: queryKeys.feed.authorHousesAll(userId) }),
          client.invalidateQueries({ queryKey: queryKeys.myHouses(userId) }),
          client.invalidateQueries({ queryKey: queryKeys.myJoinRequests(userId) }),
        ]);
        return result;
      } finally {
        busy.current = false;
        setJoiningId(null);
      }
    },
    [client, errorRef, mutateAsync, postId, userId],
  );

  return useMemo(
    () => ({
      houses: data ?? NO_HOUSES,
      loading: data === undefined && isFetching,
      error: data === undefined && isError,
      joiningId,
      refresh,
      join,
    }),
    [data, isFetching, isError, joiningId, refresh, join],
  );
}
