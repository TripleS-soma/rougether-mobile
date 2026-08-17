/**
 * 연속 출석 이벤트 (#851) — 진행 중인 이벤트 상태와 오늘 출석 액션.
 *
 * 이벤트가 없을 때가 정상 상태다: 서버는 404 `ATTENDANCE_EVENT_NOT_FOUND`를
 * 주고, 훅은 그걸 에러가 아니라 `status = null`로 접는다. 진입점(헤더
 * 아이콘)은 status가 있을 때만 그려진다.
 *
 * 반환 객체는 useMemo, 액션은 useCallback — memo 경계(#539)를 뚫지 않게.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, ErrorCode, checkInAttendance, fetchAttendance } from '@/api';
import type { AttendanceCheckInResult, AttendanceStatus } from '@/api/events';

export type UseAttendanceOptions = {
  enabled?: boolean;
  /** 출석 코인이 지갑에 반영되게 셸의 잔액을 갱신한다. */
  onCoinBalance?: (balance: number) => void;
};

/**
 * 이벤트로 인정할 만한 응답인지 — `eventId`와 보상표가 있어야 한다.
 *
 * 서버가 200에 빈/부분 바디를 주면 예전엔 `status`가 truthy가 돼서 시트가
 * `dailyRewards[0]`에서 터졌고, 셸 전체가 같이 죽었다. 출석은 부가 기능이라
 * **이상한 응답은 "이벤트 없음"으로 접는 게 맞다** — 앱을 멈출 이유가 없다.
 */
function isUsableStatus(s: AttendanceStatus | null | undefined): s is AttendanceStatus {
  return !!s && typeof s.eventId === 'number' && Array.isArray(s.dailyRewards);
}

export function useAttendance({ enabled = true, onCoinBalance }: UseAttendanceOptions = {}) {
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  // "아직 안 불러봤다"와 "이벤트가 없다"를 구분한다 — 이게 없으면 부팅 직후
  // 헤더 아이콘이 잠깐 떴다 사라진다.
  const [loaded, setLoaded] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  // 콜백 참조를 effect 의존성에서 떼어낸다(부모 리렌더마다 재요청 방지).
  const onCoinBalanceRef = useRef(onCoinBalance);
  onCoinBalanceRef.current = onCoinBalance;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      const next = await fetchAttendance().catch((e: unknown) => {
        // 404 = 진행 중인 이벤트 없음. 그 외(네트워크·5xx)도 이벤트를 숨기는
        // 쪽으로 접는다 — 출석은 부가 기능이라 화면을 막을 이유가 없다.
        if (e instanceof ApiError && e.code === ErrorCode.ATTENDANCE_EVENT_NOT_FOUND) return null;
        return null;
      });
      if (!active) return;
      setStatus(isUsableStatus(next) ? next : null);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [enabled]);

  /**
   * 오늘 출석. 성공하면 갱신된 상태로 갈아끼우고 결과를 그대로 돌려준다 —
   * **연출을 쏠지 말지는 호출부가 `newCheckIn`으로 판단한다.** 멱등 재호출은
   * `newCheckIn=false`·`coinRewardAmount=0`이라 여기서 연출을 쏘면 거짓말이
   * 된다(거미줄 청소 #830과 같은 계약).
   */
  const checkIn = useCallback(async (): Promise<AttendanceCheckInResult | null> => {
    if (checkingIn) return null;
    setCheckingIn(true);
    try {
      const result = await checkInAttendance();
      if (isUsableStatus(result.status)) setStatus(result.status);
      onCoinBalanceRef.current?.(result.coinBalance);
      return result;
    } catch {
      return null;
    } finally {
      setCheckingIn(false);
    }
  }, [checkingIn]);

  return useMemo(
    () => ({ status, loaded, checkingIn, checkIn }),
    [status, loaded, checkingIn, checkIn],
  );
}
