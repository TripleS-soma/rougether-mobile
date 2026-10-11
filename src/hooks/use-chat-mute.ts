/**
 * 채팅방 푸시 음소거 (서버 #435) — 방마다 사용자별 값이라 방 상태(`useHouseChat`)와 따로 받는다.
 * react-query(#1027): 조회는 `useQuery`, 바꾸기는 낙관적으로 캐시를 먼저 고치고 실패하면 되돌린다.
 *
 * 돌려주는 객체는 참조 고정(#539) — `mutateAsync`만 꺼내 쓰고 연타는 ref로 막는다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { getSessionUserId } from '@/api/auth';
import {
  type ChatNotificationState,
  fetchChatNotification,
  updateChatNotification,
} from '@/api/chat';
import { useLatestRef } from '@/hooks/use-stable-value';
import { queryKeys } from '@/lib/query-keys';

export function useChatMute({
  roomId,
  onError,
}: {
  roomId: number | null | undefined;
  /** 바꾸기 실패 — 호출부가 안내한다(되돌리기는 여기서). */
  onError?: () => void;
}) {
  const userId = getSessionUserId();
  const queryClient = useQueryClient();
  const key = queryKeys.chatMute(userId, roomId);
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => fetchChatNotification(roomId as number),
    enabled: roomId != null,
  });
  const muted = data?.muted ?? false;

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (next: boolean) => updateChatNotification(roomId as number, next),
  });
  const busyRef = useLatestRef(isPending);
  const mutedRef = useLatestRef(muted);
  const onErrorRef = useLatestRef(onError);

  const toggle = useCallback(async () => {
    if (roomId == null || busyRef.current) return;
    const k = queryKeys.chatMute(userId, roomId);
    const next = !mutedRef.current;
    queryClient.setQueryData<ChatNotificationState>(k, { roomId, muted: next });
    try {
      const saved = await mutateAsync(next);
      queryClient.setQueryData<ChatNotificationState>(k, saved);
    } catch {
      queryClient.setQueryData<ChatNotificationState>(k, { roomId, muted: !next });
      onErrorRef.current?.();
    }
  }, [roomId, userId, busyRef, mutedRef, onErrorRef, queryClient, mutateAsync]);

  return useMemo(() => ({ muted, loaded: data != null, toggle }), [muted, data, toggle]);
}
