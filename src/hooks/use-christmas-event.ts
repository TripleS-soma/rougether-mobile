import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  checkInAttendanceEvent,
  claimAttendanceCharacter,
  dismissChristmasPopup,
  fetchAttendanceEvent,
  fetchChristmasEvent,
  getSessionUserId,
  type AttendanceCheckInResult,
  type AttendanceCharacterRewardResult,
  type AttendanceStatus,
  type ChristmasEvent,
} from '@/api';
import { useToast } from '@/components/ui/toast';
import { i18n } from '@/i18n';
import { useWallet } from '@/hooks/use-wallet';
import { queryKeys } from '@/lib/query-keys';
import { todayIso, toKstDate } from '@/utils/datetime';

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
  const { show: toast } = useToast();
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
  const today = todayIso();
  const updatedToday = (updatedAt: number) =>
    updatedAt > 0 && toKstDate(new Date(updatedAt)) === today;
  // A parent render after KST midnight must not treat yesterday's successful cache as today's check.
  const checkedDateMatchesToday =
    !status?.checkedInToday ||
    (Array.isArray(status.checkInDates) && status.checkInDates.includes(today));
  const freshForToday =
    checkedDateMatchesToday &&
    metadata.isSuccess &&
    updatedToday(metadata.dataUpdatedAt) &&
    (eventId == null || (attendance.isSuccess && updatedToday(attendance.dataUpdatedAt)));
  const lock = useRef(false);
  const [actionBusy, setActionBusy] = useState(false);
  const { mutateAsync: checkInMutation, isPending: checkingIn } = useMutation({
    mutationFn: checkInAttendanceEvent,
    retry: false,
  });
  const { mutateAsync: claimCharacterMutation, isPending: claimingCharacter } = useMutation({
    mutationFn: claimAttendanceCharacter,
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
    setActionBusy(true);
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
          qc.invalidateQueries({ queryKey: queryKeys.myCharacters.byUser(userId) }),
        ]);
      }
      lock.current = false;
      setActionBusy(false);
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

  const attemptedCharacter = useRef(new Set<string>());
  const claimCharacter = useCallback(async (): Promise<{
    result: AttendanceCharacterRewardResult | null;
    recovered: boolean;
  }> => {
    if (
      getSessionUserId() !== userId ||
      lock.current ||
      !event?.active ||
      eventId == null ||
      !status?.characterReward?.claimable
    )
      return { result: null, recovered: false };
    lock.current = true;
    setActionBusy(true);
    try {
      attemptedCharacter.current.add(`${userId}:${eventId}`);
      const result = await claimCharacterMutation(eventId);
      if (getSessionUserId() !== userId) return { result: null, recovered: false };
      if (usable(result.status))
        qc.setQueryData(queryKeys.attendanceEvent(userId, eventId), result.status);
      if (result.grantedNow)
        toast(
          i18n.t('christmas.characterReceived', {
            name: result.status.characterReward?.name ?? i18n.t('member.characters.fox.name'),
          }),
          'success',
        );
      return { result, recovered: false };
    } catch {
      if (getSessionUserId() !== userId) return { result: null, recovered: false };
      // 응답을 잃어도 POST를 자동 재전송하지 않음. 확정한 보유 상태만 다시 읽음.
      const latest = await qc
        .fetchQuery({
          queryKey: queryKeys.attendanceEvent(userId, eventId),
          queryFn: () => forSession(userId, () => fetchAttendanceEvent(eventId)),
          staleTime: 0,
          retry: false,
        })
        .catch(() => null);
      if (getSessionUserId() !== userId) return { result: null, recovered: false };
      const recovered = usable(latest) && latest.characterReward?.received === true;
      if (recovered)
        toast(
          i18n.t('christmas.characterReceived', { name: latest.characterReward!.name }),
          'success',
        );
      return { result: null, recovered };
    } finally {
      if (getSessionUserId() === userId)
        await qc.invalidateQueries({ queryKey: queryKeys.myCharacters.byUser(userId) });
      lock.current = false;
      setActionBusy(false);
    }
  }, [
    userId,
    event?.active,
    eventId,
    status?.characterReward?.claimable,
    claimCharacterMutation,
    qc,
    toast,
  ]);

  useEffect(() => {
    if (
      !enabled ||
      lock.current ||
      actionBusy ||
      checkingIn ||
      claimingCharacter ||
      userId == null ||
      eventId == null ||
      !freshForToday ||
      !event?.active ||
      !status?.characterReward?.claimable
    )
      return;
    const key = `${userId}:${eventId}`;
    if (attemptedCharacter.current.has(key)) return;
    // 이미 3일을 받은 계정은 별도 수령만 요청함. 오늘 출석은 대신하지 않음.
    void claimCharacter();
  }, [
    enabled,
    actionBusy,
    checkingIn,
    claimingCharacter,
    userId,
    eventId,
    freshForToday,
    event?.active,
    status?.characterReward?.claimable,
    claimCharacter,
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
      freshForToday,
      loading: metadata.isPending || (eventId != null && attendance.isPending),
      fetching: metadata.isFetching || attendance.isFetching,
      error: metadata.isError || attendance.isError || (attendance.isSuccess && !status),
      loaded: metadata.isSuccess && (eventId == null || attendance.isSuccess),
      checkingIn: actionBusy || checkingIn || claimingCharacter,
      claimingCharacter,
      dismissing,
      refresh,
      checkIn,
      claimCharacter,
      dismissPopup,
    }),
    [
      event,
      status,
      freshForToday,
      metadata.isPending,
      metadata.isFetching,
      metadata.isError,
      metadata.isSuccess,
      eventId,
      attendance.isPending,
      attendance.isFetching,
      attendance.isError,
      attendance.isSuccess,
      actionBusy,
      checkingIn,
      claimingCharacter,
      dismissing,
      refresh,
      checkIn,
      claimCharacter,
      dismissPopup,
    ],
  );
}
