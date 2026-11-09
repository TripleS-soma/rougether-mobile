import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import {
  checkInAttendanceEvent,
  dismissChristmasPopup,
  fetchAttendanceEvent,
  fetchChristmasEvent,
  getSessionUserId,
  type AttendanceCheckInResult,
  type AttendanceStatus,
  type ChristmasEvent,
} from '@/api';
import { useWallet } from '@/hooks/use-wallet';
import { queryKeys } from '@/lib/query-keys';

const usable = (status: AttendanceStatus | null | undefined): status is AttendanceStatus =>
  !!status &&
  status.mode === 'CUMULATIVE' &&
  Number.isInteger(status.eventId) &&
  typeof status.progressDays === 'number' &&
  Array.isArray(status.dailyRewards);

/** Do not execute or cache an old account's request with a replacement session. */
async function forSession<T>(
  userId: number | null | undefined,
  fetch: () => Promise<T>,
): Promise<T | null> {
  if (userId == null || getSessionUserId() !== userId) return null;
  const value = await fetch();
  return getSessionUserId() === userId ? value : null;
}

export function useChristmasEvent({ enabled = true } = {}) {
  const userId = getSessionUserId();
  const qc = useQueryClient();
  const { setWallet, refreshWallet } = useWallet();
  const metadata = useQuery({
    queryKey: queryKeys.christmas(userId),
    queryFn: () => forSession(userId, fetchChristmasEvent),
    enabled: enabled && userId != null,
    staleTime: 0,
    retry: false,
  });
  const event = metadata.data?.code === 'christmas_2026' ? metadata.data : null;
  const eventId = event?.attendanceEventId;
  const attendance = useQuery({
    queryKey: queryKeys.attendanceEvent(userId, eventId),
    queryFn: () => forSession(userId, () => fetchAttendanceEvent(eventId!)),
    enabled: enabled && userId != null && eventId != null && eventId > 0,
    staleTime: 0,
    retry: false,
  });
  const status = usable(attendance.data) ? attendance.data : null;
  const lock = useRef(false);
  const { mutateAsync: checkInMutation, isPending: checkingIn } = useMutation({
    mutationFn: checkInAttendanceEvent,
    retry: false,
  });
  const { mutateAsync: dismissMutation, isPending: dismissing } = useMutation({
    mutationFn: dismissChristmasPopup,
    retry: false,
  });
  const refetchMetadata = metadata.refetch;
  const refresh = useCallback(async () => {
    if (getSessionUserId() !== userId) return null;
    const next = await refetchMetadata();
    if (getSessionUserId() !== userId) return null;
    const id = next.data?.attendanceEventId;
    if (id == null || id <= 0) return null;
    return qc
      .fetchQuery({
        queryKey: queryKeys.attendanceEvent(userId, id),
        queryFn: () => forSession(userId, () => fetchAttendanceEvent(id)),
        staleTime: 0,
        retry: false,
      })
      .catch(() => null);
  }, [refetchMetadata, qc, userId]);

  const checkIn = useCallback(async (): Promise<{
    result: AttendanceCheckInResult | null;
    recovered: boolean;
  }> => {
    if (
      getSessionUserId() !== userId ||
      lock.current ||
      eventId == null ||
      !event?.active ||
      status?.active === false ||
      status?.completed ||
      !status?.availableToday
    ) {
      return { result: null, recovered: false };
    }
    lock.current = true;
    try {
      const result = await checkInMutation(eventId);
      if (getSessionUserId() !== userId) return { result: null, recovered: false };
      if (usable(result.status))
        qc.setQueryData(queryKeys.attendanceEvent(userId, eventId), result.status);
      setWallet((wallet) => ({ ...wallet, coin: result.coinBalance }));
      return { result, recovered: false };
    } catch {
      if (getSessionUserId() !== userId) return { result: null, recovered: false };
      // A lost response may already have persisted. Re-read the same event, never re-send automatically.
      const latest = await qc
        .fetchQuery({
          queryKey: queryKeys.attendanceEvent(userId, eventId),
          queryFn: () => forSession(userId, () => fetchAttendanceEvent(eventId)),
          staleTime: 0,
          retry: false,
        })
        .catch(() => null);
      if (getSessionUserId() !== userId) return { result: null, recovered: false };
      return { result: null, recovered: usable(latest) && latest.checkedInToday };
    } finally {
      if (getSessionUserId() === userId) {
        await Promise.all([
          refreshWallet(),
          qc.invalidateQueries({ queryKey: queryKeys.myItems.all }),
          qc.invalidateQueries({ queryKey: queryKeys.walletHistory(userId) }),
        ]);
      }
      lock.current = false;
    }
  }, [
    eventId,
    event?.active,
    status?.active,
    status?.completed,
    status?.availableToday,
    checkInMutation,
    qc,
    userId,
    setWallet,
    refreshWallet,
  ]);

  const dismissPopup = useCallback(async () => {
    if (getSessionUserId() !== userId) return false;
    try {
      await dismissMutation();
      if (getSessionUserId() !== userId) return false;
      qc.setQueryData<ChristmasEvent>(queryKeys.christmas(userId), (old) =>
        old ? { ...old, popupDismissed: true } : old,
      );
      return true;
    } catch {
      return false;
    }
  }, [dismissMutation, qc, userId]);

  return useMemo(
    () => ({
      event,
      status,
      loading: metadata.isPending || (eventId != null && attendance.isPending),
      fetching: metadata.isFetching || attendance.isFetching,
      error: metadata.isError || attendance.isError || (attendance.isSuccess && !status),
      loaded: metadata.isSuccess && (eventId == null || attendance.isSuccess),
      checkingIn,
      dismissing,
      refresh,
      checkIn,
      dismissPopup,
    }),
    [
      event,
      status,
      metadata.isPending,
      metadata.isFetching,
      metadata.isError,
      metadata.isSuccess,
      eventId,
      attendance.isPending,
      attendance.isFetching,
      attendance.isError,
      attendance.isSuccess,
      checkingIn,
      dismissing,
      refresh,
      checkIn,
      dismissPopup,
    ],
  );
}
