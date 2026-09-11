import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { Screen } from '@/components/app/navigation';
import { AttendanceSheet } from '@/components/screens/sheets/attendance-sheet';
import { WalletHistorySheet } from '@/components/screens/sheets/wallet-history-sheet';
import type { Wallet } from '@/constants/currency';
import { useAttendance } from '@/hooks/use-attendance';
import { useLatestRef } from '@/hooks/use-stable-value';
import { REVIEW_PROMPT_DELAY_MS } from '@/hooks/use-store-review';
import { useWalletHistory } from '@/hooks/use-wallet-history';
import { todayIso } from '@/utils/datetime';

/**
 * 그날 첫 완료 뒤 출석 시트를 여는 간격 (#1294) — 보상 알약(2.2초)이 사라진 뒤라
 * 스토어 리뷰 요청(#1107)과 같은 값을 쓴다. 축하 연출 위에 시트가 겹치지 않게.
 */
export const AUTO_ATTENDANCE_DELAY_MS = REVIEW_PROMPT_DELAY_MS;

/**
 * 출석 이벤트·재화 내역 시트 (앱 셸에서 분리, 리팩토링 4묶음) — 데이터 훅·열림 상태·시트
 * JSX를 한 곳에. 셸은 콜백을 내 정보 바로가기(#1089)·가구 스튜디오에 꿰고 `sheets`를 그린다.
 *
 * - 연속 출석 (#851): 진행 중인 이벤트가 없으면 status가 null이라 바로가기도 시트도 없다.
 *   출석 코인은 응답의 잔액으로 지갑을 맞춘다(뽑기·상점과 같은 결).
 * - 자동 출석 (#1294): 그날 첫 완료(루틴·할 일)면 `openAttendanceAfterFirstCompletion`이
 *   시트를 자동 출석 모드로 연다. 버튼 출석은 그대로 남는다.
 * - 재화 내역 (#734 → #1089): 열 때마다 1페이지 재로드(완료 취소로 이력이 지워질 수 있음).
 *
 * 돌려주는 콜백은 전부 useCallback — 내 정보 화면(memo 경계 #539)까지 내려간다.
 */
export function useAttendanceSurface({
  setWallet,
  setScreen,
}: {
  setWallet: Dispatch<SetStateAction<Wallet>>;
  setScreen: Dispatch<SetStateAction<Screen>>;
}) {
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  // 이번 열림이 그날 첫 완료로 연 것인가 — 시트가 열리자마자 출석을 보낸다.
  const [autoCheckIn, setAutoCheckIn] = useState(false);
  const syncCoin = useCallback((coin: number) => setWallet((w) => ({ ...w, coin })), [setWallet]);
  const attendance = useAttendance({ onCoinBalance: syncCoin });
  const openFurnitureStudio = useCallback(() => setScreen('furnitureStudio'), [setScreen]);
  const openAttendance = useCallback(() => {
    setAutoCheckIn(false);
    setAttendanceOpen(true);
  }, []);
  const closeAttendance = useCallback(() => {
    setAttendanceOpen(false);
    setAutoCheckIn(false);
  }, []);
  // 오늘 미출석 — 내 정보 타일·하단 탭 배지 (#1089). 이벤트가 없으면 false.
  const attendancePending = !!attendance.status && !attendance.status.checkedInToday;

  /**
   * 그날 첫 완료 뒤 자동 출석 (#1294). 완료 콜백이 부르는 시점의 **최신** 상태로 판단한다 —
   * 이벤트 없음·오늘 출석함·완주면 아무것도 안 한다. 같은 날 두 번째 완료(취소 후 재완료
   * 포함)는 날짜 가드로 막는다: 자동 요청이 실패해 checkedInToday가 그대로여도 시트를
   * 다시 들이밀지 않는다 — 그땐 시트의 버튼이 남아 있다.
   */
  const statusRef = useLatestRef(attendance.status);
  const autoDateRef = useRef<string | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    },
    [],
  );
  const openAttendanceAfterFirstCompletion = useCallback(() => {
    const status = statusRef.current;
    const today = todayIso();
    if (!status || status.checkedInToday || status.completed) return;
    if (autoDateRef.current === today) return;
    autoDateRef.current = today;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      autoTimer.current = null;
      setAutoCheckIn(true);
      setAttendanceOpen(true);
    }, AUTO_ATTENDANCE_DELAY_MS);
  }, [statusRef]);

  const walletHistory = useWalletHistory();
  const [walletHistoryOpen, setWalletHistoryOpen] = useState(false);
  const { load: loadWalletHistory } = walletHistory;
  const openWalletHistory = useCallback(() => {
    setWalletHistoryOpen(true);
    loadWalletHistory();
  }, [loadWalletHistory]);

  const sheets = (
    <>
      {/* 연속 출석 시트 (#851) — 이벤트가 있을 때만 존재한다. */}
      {attendance.status ? (
        <AttendanceSheet
          visible={attendanceOpen}
          status={attendance.status}
          checkingIn={attendance.checkingIn}
          onCheckIn={attendance.checkIn}
          autoCheckIn={autoCheckIn}
          onGoToStudio={() => {
            closeAttendance();
            openFurnitureStudio();
          }}
          onGoToRoom={() => {
            closeAttendance();
            setScreen('decor');
          }}
          onClose={closeAttendance}
        />
      ) : null}
      {/* 재화 내역 시트 (#734 → #1089) — 내 정보 바로가기가 연다. */}
      <WalletHistorySheet
        visible={walletHistoryOpen}
        onClose={() => setWalletHistoryOpen(false)}
        entries={walletHistory.entries}
        loading={walletHistory.loading}
        loadError={walletHistory.error}
        onRetry={walletHistory.load}
        hasNext={walletHistory.hasNext}
        onLoadMore={walletHistory.loadMore}
      />
    </>
  );

  return {
    attendance,
    attendancePending,
    openAttendance,
    openAttendanceAfterFirstCompletion,
    openFurnitureStudio,
    openWalletHistory,
    sheets,
  };
}
