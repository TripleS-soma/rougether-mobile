/**
 * Server-backed push notification settings (#495) —
 * GET /users/me/notification-settings on demand, then an optimistic PATCH per
 * toggle. The server PATCH is partial (only the flipped key travels) and keeps
 * group values under all=false, so rollback is just flipping the key back.
 *
 * react-query로 이관 (#1027, 장부 16번). 캐시에는 앱 모양(`toNotificationSettings`
 * 적용값)을 둔다 — 낙관 토글이 `setQueryData` 한 줄이 되고 실패 시 스냅샷으로
 * 되돌린다. 조회는 설정 화면이 열 때 `load`로만 한다(`enabled: false`).
 */
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchNotificationSettings, getSessionUserId, updateNotificationSettings } from '@/api';
import { toNotificationSettings } from '@/api/adapters';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '@/components/screens/notification-settings-screen';
import { useLatestRef } from '@/hooks/use-stable-value';
import { queryKeys } from '@/lib/query-keys';

const fetchSettings = async () => toNotificationSettings(await fetchNotificationSettings());

export function useNotificationSettings(onError?: (message: string) => void) {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  const queryKey = useMemo(() => queryKeys.notificationSettings(userId), [userId]);
  // 호출부가 인라인 화살표를 넘겨도 toggle 참조가 흔들리지 않게.
  const onErrorRef = useLatestRef(onError);

  // 조회 실패 (#549) — 기본값이 서버값처럼 보이지 않도록 화면이 안내 배너
  // + 다시 불러오기를 보여준다. 재조회 성공 시 해제. 실패해도 마지막으로
  // 받은 값(data)은 남는다 — 화면은 계속 쓸 수 있다.
  const { data, isError, refetch } = useQuery({
    queryKey,
    queryFn: fetchSettings,
    enabled: false,
  });

  /** Refresh from the server (call when the settings screen opens). */
  const load = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const { mutate } = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) => updateNotificationSettings(patch),
    // 낙관 반영 — 캐시를 바로 바꾸고 스냅샷을 컨텍스트로 넘긴다. 아직 못 받았으면
    // (조회 실패로 기본값을 보는 중) 기본값 위에 얹는다.
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey });
      const before = qc.getQueryData<NotificationSettings>(queryKey);
      qc.setQueryData<NotificationSettings>(queryKey, (prev) => ({
        ...(prev ?? DEFAULT_NOTIFICATION_SETTINGS),
        ...patch,
      }));
      return { before };
    },
    onSuccess: (res) => qc.setQueryData(queryKey, toNotificationSettings(res)),
    onError: (_err, _patch, ctx) => {
      qc.setQueryData(queryKey, ctx?.before);
      onErrorRef.current?.('알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    },
  });

  const toggle = useCallback(
    (key: keyof NotificationSettings, value: boolean) => mutate({ [key]: value }),
    [mutate],
  );

  const settings = data ?? DEFAULT_NOTIFICATION_SETTINGS;
  return useMemo(
    () => ({ settings, loadError: isError, load, toggle }),
    [settings, isError, load, toggle],
  );
}
