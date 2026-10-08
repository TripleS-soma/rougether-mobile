/**
 * 연속 출석 이벤트 (#851) — 진행 중인 이벤트 상태와 오늘 출석 액션.
 *
 * 이벤트가 없을 때가 정상 상태다: 서버는 404 `ATTENDANCE_EVENT_NOT_FOUND`를
 * 주고, 훅은 그걸 에러가 아니라 `status = null`로 접는다. 진입점(헤더
 * 아이콘)은 status가 있을 때만 그려진다.
 *
 * 서버 상태는 react-query (#1027, 리팩토링 장부 16번) — 출석하면 응답의 새 상태를
 * 캐시에 바로 써 넣는다(재조회 없이).
 *
 * 반환 객체는 useMemo, 액션은 useCallback — memo 경계(#539)를 뚫지 않게.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { ApiError, ErrorCode, checkInAttendance, fetchAttendance, getSessionUserId } from '@/api';
import type { AttendanceCheckInResult, AttendanceStatus } from '@/api/events';
import { useLatestRef } from '@/hooks/use-stable-value';
import { queryKeys } from '@/lib/query-keys';

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

async function loadAttendance(): Promise<AttendanceStatus | null> {
  const next = await fetchAttendance().catch((e: unknown) => {
    // 404 = 진행 중인 이벤트 없음. 그 외(네트워크·5xx)도 이벤트를 숨기는
    // 쪽으로 접는다 — 출석은 부가 기능이라 화면을 막을 이유가 없다.
    if (e instanceof ApiError && e.code === ErrorCode.ATTENDANCE_EVENT_NOT_FOUND) return null;
    return null;
  });
  return isUsableStatus(next) ? next : null;
}

export function useAttendance({ enabled = true, onCoinBalance }: UseAttendanceOptions = {}) {
  const userId = getSessionUserId();
  const queryClient = useQueryClient();
  const key = queryKeys.attendance(userId);
  const query = useQuery({ queryKey: key, queryFn: loadAttendance, enabled });
  const status = query.data ?? null;
  // "아직 안 불러봤다"와 "이벤트가 없다"를 구분한다 — 이게 없으면 부팅 직후
  // 헤더 아이콘이 잠깐 떴다 사라진다.
  const loaded = query.isSuccess;

  // 콜백 참조를 의존성에서 떼어낸다(부모 리렌더마다 checkIn이 새로 생기지 않게).
  const onCoinBalanceRef = useLatestRef(onCoinBalance);
  // useMutation 객체는 매 렌더 새것 — mutateAsync만 꺼내 쓴다(#539).
  const { mutateAsync, isPending: checkingIn } = useMutation({ mutationFn: checkInAttendance });
  const checkingInRef = useLatestRef(checkingIn);

  /**
   * 오늘 출석. 성공하면 갱신된 상태로 갈아끼우고 결과를 그대로 돌려준다 —
   * **연출을 쏠지 말지는 호출부가 `newCheckIn`으로 판단한다.** 멱등 재호출은
   * `newCheckIn=false`·`coinRewardAmount=0`이라 여기서 연출을 쏘면 거짓말이
   * 된다(거미줄 청소 #830과 같은 계약).
   */
  const checkIn = useCallback(async (): Promise<AttendanceCheckInResult | null> => {
    if (checkingInRef.current) return null;
    try {
      const result = await mutateAsync();
      if (isUsableStatus(result.status)) {
        queryClient.setQueryData(queryKeys.attendance(userId), result.status);
      }
      onCoinBalanceRef.current?.(result.coinBalance);
      return result;
    } catch {
      return null;
    }
  }, [checkingInRef, mutateAsync, queryClient, userId, onCoinBalanceRef]);

  return useMemo(
    () => ({ status, loaded, checkingIn, checkIn }),
    [status, loaded, checkingIn, checkIn],
  );
}
