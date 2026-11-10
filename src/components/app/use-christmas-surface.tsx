import { useCallback, useEffect, useRef, useState } from 'react';

import { AppState } from 'react-native';

import type { AttendanceCheckInResult } from '@/api';
import { getSessionUserId } from '@/api';
import { ChristmasAttendanceModal } from '@/components/screens/christmas/christmas-attendance-modal';
import { ChristmasEventPopup } from '@/components/screens/christmas/christmas-event-popup';
import { useChristmasEvent } from '@/hooks/use-christmas-event';
import { registerPriorityModal } from '@/lib/modal-presence';
import { useT } from '@/i18n';
import { todayIso } from '@/utils/datetime';

type Active = 'attendance' | 'popup' | null;

/** A single active modal; the next item starts only after the native dismissal callback. */
export function useChristmasSurface({
  home,
  ready,
  blocked,
  onGoGacha,
}: {
  home: boolean;
  ready: boolean;
  blocked: boolean;
  onGoGacha: (machineId: number) => void;
}) {
  const userId = getSessionUserId();
  const tr = useT();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [homeRefreshPending, setHomeRefreshPending] = useState(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      if (state === 'active' && wanted.current) {
        setHomeRefreshPending(true);
        void latest.current.refresh().finally(() => setHomeRefreshPending(false));
      }
    });
    return () => subscription.remove();
  }, []);
  const wanted = useRef(false);
  if (home && ready) wanted.current = true;
  const christmas = useChristmasEvent({ enabled: wanted.current });
  const [active, setActive] = useState<Active>(null);
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<AttendanceCheckInResult | null>(null);
  const [actionError, setActionError] = useState(false);
  const flow = useRef<string | null>(null);
  const pendingPopup = useRef(false);
  const holdsPriority = active !== null || (pendingPopup.current && home);
  useEffect(() => {
    if (holdsPriority) return registerPriorityModal();
  }, [holdsPriority]);
  const afterClose = useRef<number | null>(null);
  const activeRef = useRef<Active>(null);
  const visibleRef = useRef(false);
  visibleRef.current = visible;
  activeRef.current = active;
  const latest = useRef(christmas);
  latest.current = christmas;
  useEffect(() => {
    activeRef.current = null;
    visibleRef.current = false;
    pendingPopup.current = false;
    afterClose.current = null;
    flow.current = null;
    setActive(null);
    setVisible(false);
    setResult(null);
    setActionError(false);
    setHomeRefreshPending(false);
  }, [userId]);
  const dayKey = `${userId}:${todayIso()}`; // deduplication only; server availableToday decides eligibility.

  const show = useCallback((next: Active) => {
    setActionError(false);
    setResult(null);
    activeRef.current = next;
    setActive(next);
    setVisible(true);
  }, []);

  const wasHome = useRef(home);
  const returningHome = home && !wasHome.current;
  useEffect(() => {
    if (
      returningHome ||
      homeRefreshPending ||
      !home ||
      !ready ||
      !appActive ||
      blocked ||
      active ||
      christmas.fetching ||
      !christmas.loaded ||
      !christmas.freshForToday ||
      christmas.error
    )
      return;
    if (pendingPopup.current) {
      pendingPopup.current = false;
      if (christmas.event?.active && !christmas.event.popupDismissed) show('popup');
      return;
    }
    if (flow.current === dayKey || !christmas.event?.active) return;
    flow.current = dayKey;
    pendingPopup.current = !christmas.event.popupDismissed;
    if (
      christmas.status?.availableToday &&
      !christmas.status.completed &&
      (christmas.status.progressDays ?? 0) < christmas.status.targetDays
    ) {
      show('attendance');
    } else if (pendingPopup.current) {
      pendingPopup.current = false;
      show('popup');
    }
  }, [
    home,
    returningHome,
    homeRefreshPending,
    ready,
    appActive,
    blocked,
    active,
    christmas.fetching,
    christmas.loaded,
    christmas.freshForToday,
    christmas.error,
    christmas.event,
    christmas.status,
    dayKey,
    show,
  ]);

  // Returning home and app-focus refetch keep KST-day state authoritative without a midnight takeover.
  const refresh = christmas.refresh;
  useEffect(() => {
    if (home && !wasHome.current && wanted.current) {
      setHomeRefreshPending(true);
      void refresh().finally(() => setHomeRefreshPending(false));
    }
    wasHome.current = home;
  }, [home, refresh]);

  const open = useCallback(() => {
    if (activeRef.current) return;
    wanted.current = true;
    if (
      latest.current.event?.active &&
      latest.current.loaded &&
      !latest.current.fetching &&
      !latest.current.error
    ) {
      flow.current = dayKey;
    }
    pendingPopup.current = false;
    show('attendance');
    void latest.current.refresh();
  }, [dayKey, show]);

  const closeAttendance = useCallback(() => {
    if (!latest.current.checkingIn) setVisible(false);
  }, []);
  const onCheckIn = useCallback(async () => {
    const requestUser = getSessionUserId();
    setActionError(false);
    const next = await latest.current.checkIn();
    if (getSessionUserId() !== requestUser) return;
    if (next.result) setResult(next.result);
    else if (next.recovered) setVisible(false);
    else setActionError(true);
  }, []);
  const closePopup = useCallback(async (permanent: boolean) => {
    if (latest.current.dismissing) return;
    const requestUser = getSessionUserId();
    setActionError(false);
    const saved = !permanent || (await latest.current.dismissPopup());
    if (getSessionUserId() !== requestUser) return;
    if (!saved) {
      setActionError(true);
      return;
    }
    setVisible(false);
  }, []);
  const dismissed = useCallback(
    (stage: Active) => {
      if (activeRef.current !== stage || visibleRef.current) return;
      activeRef.current = null;
      setActive(null);
      setResult(null);
      const next = afterClose.current;
      afterClose.current = null;
      if (typeof next === 'number') onGoGacha(next);
    },
    [onGoGacha],
  );
  const goGacha = useCallback(() => {
    const id = latest.current.event?.gachaId;
    if (!latest.current.event?.active || id == null || !Number.isInteger(id) || id <= 0) return;
    pendingPopup.current = false;
    afterClose.current = id;
    setVisible(false);
  }, []);
  const goEvent = useCallback(
    async (permanent = false) => {
      if (latest.current.dismissing) return;
      const requestUser = getSessionUserId();
      setActionError(false);
      if (permanent && !(await latest.current.dismissPopup())) {
        if (getSessionUserId() !== requestUser) return;
        setActionError(true);
        return;
      }
      if (getSessionUserId() === requestUser) goGacha();
    },
    [goGacha],
  );

  const overlays = (
    <>
      <ChristmasAttendanceModal
        visible={active === 'attendance' && visible}
        status={christmas.status}
        loading={christmas.loading || christmas.fetching}
        error={christmas.error || actionError}
        checkingIn={christmas.checkingIn}
        result={result}
        onCheckIn={onCheckIn}
        onClose={closeAttendance}
        onDismissed={() => dismissed('attendance')}
        onRetry={christmas.refresh}
        onGoGacha={christmas.event?.active && christmas.event.gachaId ? goGacha : undefined}
      />
      <ChristmasEventPopup
        visible={active === 'popup' && visible}
        title={christmas.event?.title ?? tr('christmas.title')}
        endsOn={christmas.event?.endsOn ?? ''}
        dismissing={christmas.dismissing}
        error={actionError}
        onClose={closePopup}
        onDismissed={() => dismissed('popup')}
        onGoEvent={goEvent}
      />
    </>
  );
  return { open, overlays, active: active !== null, pending: !!christmas.status?.availableToday };
}
