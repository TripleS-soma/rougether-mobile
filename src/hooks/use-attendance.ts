/**
 * 연속 출석 이벤트 (#851) — 진행 중인 이벤트 상태와 오늘 출석 액션.
 *
 * 이벤트가 없을 때가 정상 상태다: 서버는 404 `ATTENDANCE_EVENT_NOT_FOUND`를
 * 주고, 훅은 그걸 에러가 아니라 `status = null`로 접는다. 진입점(헤더
 * 아이콘)은 status가 있을 때만 그려진다.
 *
 * react-query로 이관 (#1027, 장부 16번). 종전엔 마운트 때 한 번만 받아서 앱을
 * 백그라운드에 두고 KST 자정을 넘기면 `checkedInToday`가 어제 값으로 남았다 —
 * 그러면 그날 첫 완료의 자동 출석(#1294)이 "이미 출석"으로 보고 시트를 안 띄운다.
 * 이제 포커스 복귀 재조회(query-client 기본값)가 이걸 되돌린다. 출석 응답의
 * status는 캐시를 바로 덮는다.
 *
 * 반환 객체는 useMemo, 액션은 useCallback — memo 경계(#539)를 뚫지 않게.
 */
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { checkInAttendance, fetchAttendance, getSessionUserId } from '@/api';
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

/**
 * 404(이벤트 없음)도, 네트워크·5xx도, 형태가 안 맞는 200도 전부 null — 출석은
 * 부가 기능이라 화면을 막을 이유가 없다. 에러를 던지지 않으므로 react-query의
 * 재시도·에러 상태 없이 null이 캐시된다(다음 stale·포커스 복귀에 다시 받는다).
 */
async function fetchStatusOrNull(): Promise<AttendanceStatus | null> {
  try {
    const next = await fetchAttendance();
    return isUsableStatus(next) ? next : null;
  } catch {
    return null;
  }
}

export function useAttendance({ enabled = true, onCoinBalance }: UseAttendanceOptions = {}) {
  const qc = useQueryClient();
  const userId = getSessionUserId();
  const queryKey = useMemo(() => queryKeys.attendance(userId), [userId]);
  // 콜백 참조를 의존성에서 떼어낸다(부모 리렌더마다 checkIn이 바뀌지 않게).
  const onCoinBalanceRef = useLatestRef(onCoinBalance);

  // "아직 안 불러봤다"와 "이벤트가 없다"를 구분한다(`loaded`) — 이게 없으면 부팅
  // 직후 헤더 아이콘이 잠깐 떴다 사라진다.
  const { data, isFetched } = useQuery({ queryKey, queryFn: fetchStatusOrNull, enabled });

  const { mutateAsync, isPending: checkingIn } = useMutation({
    mutationFn: checkInAttendance,
    onSuccess: (result) => {
      if (isUsableStatus(result.status)) qc.setQueryData(queryKey, result.status);
      onCoinBalanceRef.current?.(result.coinBalance);
    },
  });
  const checkingInRef = useLatestRef(checkingIn);

  /**
   * 오늘 출석. 성공하면 갱신된 상태로 갈아끼우고 결과를 그대로 돌려준다 —
   * **연출을 쏠지 말지는 호출부가 `newCheckIn`으로 판단한다.** 멱등 재호출은
   * `newCheckIn=false`·`coinRewardAmount=0`이라 여기서 연출을 쏘면 거짓말이
   * 된다(거미줄 청소 #830과 같은 계약). 실패는 null.
   */
  const checkIn = useCallback(async (): Promise<AttendanceCheckInResult | null> => {
    if (checkingInRef.current) return null;
    try {
      return await mutateAsync();
    } catch {
      return null;
    }
  }, [mutateAsync, checkingInRef]);

  const status = data ?? null;
  return useMemo(
    () => ({ status, loaded: isFetched, checkingIn, checkIn }),
    [status, isFetched, checkingIn, checkIn],
  );
}
