import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';

import type { Screen } from '@/components/app/navigation';
import { AttendanceSheet } from '@/components/screens/sheets/attendance-sheet';
import { WalletHistorySheet } from '@/components/screens/sheets/wallet-history-sheet';
import type { Wallet } from '@/constants/currency';
import { useAttendance } from '@/hooks/use-attendance';
import { useWalletHistory } from '@/hooks/use-wallet-history';

/**
 * 출석 이벤트·재화 내역 시트 (앱 셸에서 분리, 리팩토링 4묶음) — 데이터 훅·열림 상태·시트
 * JSX를 한 곳에. 셸은 콜백을 내 정보 바로가기(#1089)·가구 스튜디오에 꿰고 `sheets`를 그린다.
 *
 * - 연속 출석 (#851): 진행 중인 이벤트가 없으면 status가 null이라 바로가기도 시트도 없다.
 *   출석 코인은 응답의 잔액으로 지갑을 맞춘다(뽑기·상점과 같은 결).
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
  const syncCoin = useCallback((coin: number) => setWallet((w) => ({ ...w, coin })), [setWallet]);
  const attendance = useAttendance({ onCoinBalance: syncCoin });
  const openFurnitureStudio = useCallback(() => setScreen('furnitureStudio'), [setScreen]);
  const openAttendance = useCallback(() => setAttendanceOpen(true), []);
  // 오늘 미출석 — 내 정보 타일·하단 탭 배지 (#1089). 이벤트가 없으면 false.
  const attendancePending = !!attendance.status && !attendance.status.checkedInToday;

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
          onGoToStudio={() => {
            setAttendanceOpen(false);
            openFurnitureStudio();
          }}
          onGoToRoom={() => {
            setAttendanceOpen(false);
            setScreen('decor');
          }}
          onClose={() => setAttendanceOpen(false)}
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
    openFurnitureStudio,
    openWalletHistory,
    sheets,
  };
}
