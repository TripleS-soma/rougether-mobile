/**
 * 집별 새 글 푸시 설정 (집 피드) — 자유글·인증글 두 스위치. 집마다 사용자별 값이라 집 상태와 따로
 * 받는다. `use-chat-mute`와 같은 결: 조회는 `useQuery`, 바꾸기는 낙관적으로 캐시를 먼저 고치고
 * 실패하면 되돌린다.
 *
 * 서버에 이 API가 아직 없으면(404) 조회가 실패한다 — `unavailable`을 켜서 화면이 스위치를 잠그고
 * 안내하게 한다. 재시도해도 같은 답이라 4xx는 다시 묻지 않는다.
 *
 * 돌려주는 객체는 참조 고정(#539) — `mutateAsync`만 꺼내 쓰고 연타는 ref로 막는다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { getSessionUserId } from '@/api/auth';
import {
  fetchHouseFeedNotification,
  type HouseFeedNotification,
  type HouseFeedNotificationPatch,
  updateHouseFeedNotification,
} from '@/api/feed';
import { ApiError } from '@/api/http';
import { useLatestRef } from '@/hooks/use-stable-value';
import { queryKeys } from '@/lib/query-keys';

export type HouseFeedPushKey = 'freePostPush' | 'verificationPostPush';

/** 서버 기본값 — 조회 전·실패 때 화면이 그리는 값(스위치는 잠겨 있다). */
const DEFAULTS = { freePostPush: true, verificationPostPush: false } as const;

function isClientError(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500;
}

export function useHouseFeedNotification({
  houseId,
  enabled = true,
  onError,
}: {
  houseId: number | null | undefined;
  /** false면 요청하지 않는다 — 피드가 꺼진 설치본(FEED_ENABLED) 등. */
  enabled?: boolean;
  /** 바꾸기 실패 — 호출부가 안내한다(되돌리기는 여기서). */
  onError?: () => void;
}) {
  const userId = getSessionUserId();
  const queryClient = useQueryClient();
  const key = queryKeys.houseFeedNotification(userId, houseId);
  const { data, isError } = useQuery({
    queryKey: key,
    queryFn: () => fetchHouseFeedNotification(houseId as number),
    enabled: enabled && houseId != null,
    retry: (count, err) => !isClientError(err) && count < 1,
  });

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (patch: HouseFeedNotificationPatch) =>
      updateHouseFeedNotification(houseId as number, patch),
  });
  const busyRef = useLatestRef(isPending);
  const dataRef = useLatestRef(data);
  const onErrorRef = useLatestRef(onError);

  /** 스위치 하나 뒤집기 — 그 필드만 보낸다(부분 변경). */
  const toggle = useCallback(
    async (field: HouseFeedPushKey) => {
      const current = dataRef.current;
      if (houseId == null || !current || busyRef.current) return;
      const k = queryKeys.houseFeedNotification(userId, houseId);
      const next = !current[field];
      queryClient.setQueryData<HouseFeedNotification>(k, { ...current, [field]: next });
      try {
        const saved = await mutateAsync({ [field]: next });
        queryClient.setQueryData<HouseFeedNotification>(k, saved);
      } catch {
        queryClient.setQueryData<HouseFeedNotification>(k, (prev) =>
          prev ? { ...prev, [field]: !next } : prev,
        );
        onErrorRef.current?.();
      }
    },
    [houseId, userId, busyRef, dataRef, onErrorRef, queryClient, mutateAsync],
  );

  const freePostPush = data?.freePostPush ?? DEFAULTS.freePostPush;
  const verificationPostPush = data?.verificationPostPush ?? DEFAULTS.verificationPostPush;
  const loaded = data != null;
  // 받아 둔 값이 없는데 실패했다 — 서버 준비 전이거나 구성원이 아니다.
  const unavailable = isError && !loaded;

  return useMemo(
    () => ({ freePostPush, verificationPostPush, loaded, unavailable, toggle }),
    [freePostPush, verificationPostPush, loaded, unavailable, toggle],
  );
}
