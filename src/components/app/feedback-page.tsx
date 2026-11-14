import { useCallback } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSessionUserId } from '@/api/auth';
import {
  fetchSuggestions,
  fetchUpdates,
  submitSuggestion,
  type SuggestionInput,
} from '@/api/feedback';
import { FeedbackScreen } from '@/components/screens/feedback-screen';
import { queryKeys } from '@/lib/query-keys';

export function FeedbackPage({
  kind,
  onBack,
}: {
  kind: 'suggestions' | 'updates';
  onBack: () => void;
}) {
  const userId = getSessionUserId();
  const client = useQueryClient();
  const queryKey =
    kind === 'suggestions' ? queryKeys.suggestions(userId) : queryKeys.appUpdates(userId);
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      (kind === 'suggestions' ? fetchSuggestions : fetchUpdates)(pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: userId != null,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const { mutateAsync } = useMutation({ mutationFn: submitSuggestion, retry: false });
  const submit = useCallback(
    async (input: SuggestionInput) => {
      await mutateAsync(input);
      // 제출은 이미 성공했으므로 재조회 실패 때문에 재전송을 유도하지 않는다.
      void client.invalidateQueries({ queryKey: queryKeys.suggestions(userId) });
    },
    [mutateAsync, client, userId],
  );
  return (
    <FeedbackScreen
      kind={kind}
      entries={query.data?.pages.flatMap((page) => page.items)}
      loading={query.isLoading}
      error={query.isError}
      onRetry={() => {
        void query.refetch();
      }}
      hasMore={query.hasNextPage}
      loadingMore={query.isFetchingNextPage}
      onMore={() => {
        if (!query.isFetching) void query.fetchNextPage();
      }}
      onSubmit={kind === 'suggestions' ? submit : undefined}
      onBack={onBack}
    />
  );
}
