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
      // 재조회 여부는 여기서 정하지 않는다 — 이 시점의 `freshForToday`는 마지막 렌더(앱이 뒤로 가기
      // 전)의 값이라, 뒤에 있는 동안 자정이 지나도 "오늘 것"으로 보인다. 아래 복귀 이펙트가 맡는다.
      setAppActive(state === 'active');
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
  useEffect(() => {
    if (
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

  // 방 복귀·앱 복귀 재조회는 **오늘(KST) 받은 데이터가 없을 때만** 한다 (2026-11-11). 목적은 앱을 켜 둔
  // 채 자정을 넘긴 캐시를 새 날짜 상태로 바꾸는 것 하나인데, 종전에는 방으로 돌아올 때마다 요청 2개와
  // 셸 리렌더 여러 번을 복귀 슬라이드 한가운데에 만들었다. 자동 팝업은 하루 한 번(`flow`)이라 같은 날의
  // 재조회 결과는 쓰이는 곳이 없다. 날짜가 바뀌면 `freshForToday`가 false가 되어 위 큐가 멈추고,
  // 여기서 한 번 받아 오면 다시 열린다. 수동 진입(`open`)은 스스로 조회한다.
  // 앱 복귀도 같은 이펙트에서 본다 — `appActive`가 바뀐 렌더의 `freshForToday`는 지금 날짜로 다시
  // 계산된 값이라, 앱이 뒤에 있는 동안 자정을 넘긴 경우를 놓치지 않는다.
  const refresh = christmas.refresh;
  const freshForToday = christmas.freshForToday;
  const wasAppActive = useRef(appActive);
  useEffect(() => {
    const returnedHome = home && !wasHome.current;
    const cameForward = appActive && !wasAppActive.current;
    wasHome.current = home;
    wasAppActive.current = appActive;
    if ((returnedHome || cameForward) && wanted.current && !freshForToday) {
      setHomeRefreshPending(true);
      void refresh().finally(() => setHomeRefreshPending(false));
    }
  }, [home, appActive, refresh, freshForToday]);

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
