import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { AttendanceDayCell } from '@/components/screens/sheets/attendance-day-cell';
import { AttendanceTrophyReveal } from '@/components/screens/sheets/attendance-trophy-reveal';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { CountUpText } from '@/components/ui/count-up-text';
import { FlyingCoin } from '@/components/ui/flying-coin';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import type { AttendanceCheckInResult, AttendanceStatus } from '@/api/events';

export type AttendanceSheetProps = {
  visible: boolean;
  status: AttendanceStatus;
  /** 진행 중 표시 — 버튼 중복 탭을 막는다. */
  checkingIn?: boolean;
  /** 출석 요청. 결과를 돌려주면 시트가 연출을 판단해 재생한다. */
  onCheckIn?: () => Promise<AttendanceCheckInResult | null>;
  /** 완주 보상 '방에 배치하러 가기'. */
  onGoToRoom?: () => void;
  onClose?: () => void;
};

/** "2026-08-16" → "8월 16일". */
function shortDate(iso?: string) {
  const [, m, d] = (iso ?? '').split('-');
  return m && d ? `${Number(m)}월 ${Number(d)}일` : '';
}

/**
 * 연속 출석 시트 (#851) — 10칸 출석부 + 오늘 출석 버튼.
 *
 * 출석 성공 연출은 **`newCheckIn`이 true일 때만** 재생한다. 같은 날 다시
 * 누르면 서버가 멱등 성공(`coinRewardAmount=0`)을 주는데, 거기에 도장·코인을
 * 쏘면 받지도 않은 보상을 받은 것처럼 보인다(거미줄 청소 #830과 같은 계약).
 *
 * 칸의 최종 모습은 전부 `status.dailyRewards[].claimed`가 그린다 — 연출은
 * 그 위에 얹히는 장식이라, 연타·조기 닫기로 중간에 끊겨도 화면은 맞다.
 */
export function AttendanceSheet({
  visible,
  status,
  checkingIn,
  onCheckIn,
  onGoToRoom,
  onClose,
}: AttendanceSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();

  // 방금 도장 찍힌 일차 — 그 칸만 진입 연출을 재생한다.
  const [stampedDay, setStampedDay] = useState<number | null>(null);
  const [coin, setCoin] = useState<{ id: number; x: number; y: number } | null>(null);
  const [trophy, setTrophy] = useState<{ name: string; assetKey?: string } | null>(null);
  const coinSeq = useRef(0);
  /**
   * 코인 출발·도착 좌표 (#851 리뷰) — FlyingCoin은 시트 카드에 얹히므로 두 점
   * 다 **카드 기준**이어야 한다. 그런데 onLayout의 x·y는 직계 부모 기준이라,
   * 지갑은 head 기준·칸은 grid 기준으로 나와 서로 다른 좌표계였다(그 사이에
   * 제목·기간·연속일수가 쌓여 100px 넘게 어긋난다).
   *
   * head와 grid는 둘 다 카드의 직계 자식이므로, 각 컨테이너의 원점을 함께
   * 재서 안쪽 좌표에 더하면 같은 좌표계로 맞춰진다.
   */
  const cellPos = useRef<Record<number, { x: number; y: number }>>({});
  const walletPos = useRef({ x: 0, y: 0 });
  const headOrigin = useRef({ x: 0, y: 0 });
  const gridOrigin = useRef({ x: 0, y: 0 });

  const measureOrigin = useCallback(
    (into: { current: { x: number; y: number } }) => (e: LayoutChangeEvent) => {
      const { x, y } = e.nativeEvent.layout;
      into.current = { x, y };
    },
    [],
  );
  const measureWallet = useCallback((e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    walletPos.current = { x: x + width / 2, y: y + height / 2 };
  }, []);

  /**
   * 시트가 닫히면 연출 상태를 지운다 (#851 리뷰). 이게 없으면 '방에 배치하러
   * 가기'로 나간 뒤 다시 열었을 때, **출석하지도 않았는데** 트로피 리빌이 또
   * 뜬다 — AttendanceSheet는 셸에 계속 마운트돼 있어서 로컬 상태가 살아남는다.
   */
  useEffect(() => {
    if (visible) return;
    setStampedDay(null);
    setCoin(null);
    setTrophy(null);
  }, [visible]);

  const press = useCallback(async () => {
    const result = await onCheckIn?.();
    // 실패(null)거나 멱등 재호출이면 연출 없음 — 상태만 조용히 갱신된다.
    if (!result?.newCheckIn) return;
    const day = result.status.currentStreak;
    setStampedDay(day);
    if (result.coinRewardAmount > 0) {
      const cell = cellPos.current[day];
      if (cell) {
        coinSeq.current += 1;
        setCoin({
          id: coinSeq.current,
          x: gridOrigin.current.x + cell.x,
          y: gridOrigin.current.y + cell.y,
        });
      }
    }
    // 이번 호출에서 **새로** 지급된 가구만 리빌한다. 이미 갖고 있던 가구로
    // 완주 처리된 경우(rewardGrantedNow=false)는 받은 게 없다.
    if (result.rewardGrantedNow && result.status.reward) {
      setTrophy({
        name: result.status.reward.name,
        assetKey: result.status.reward.assetKey,
      });
    }
  }, [onCheckIn]);

  // 훅이 걸러 주지만 시트는 prop으로도 직접 쓰이므로 여기서도 방어한다.
  const days = status.dailyRewards ?? [];
  const base = days[0]?.coinAmount ?? 0;
  const period = `${shortDate(status.startsOn)} ~ ${shortDate(status.endsOn)}`;
  const buttonLabel = status.completed
    ? '이벤트를 완주했어요'
    : status.checkedInToday
      ? '오늘 출석 완료'
      : '오늘 출석하기';

  return (
    <BottomSheet visible={visible} onClose={onClose} cardStyle={styles.sheet}>
      <View style={styles.head} onLayout={measureOrigin(headOrigin)}>
        <Text style={[Typography.h3, styles.title, { color: t.text }]}>{status.title}</Text>
        <View
          onLayout={measureWallet}
          style={[styles.walletPill, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="coin" size={16} color={t.warning} />
        </View>
      </View>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>{period}</Text>

      <View style={styles.streakRow}>
        <CountUpText
          value={status.currentStreak}
          suffix="일차"
          style={[Typography.display2, emph('bold'), { color: t.primaryText }]}
        />
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          목표 {status.targetDays}일
        </Text>
      </View>

      <View style={styles.grid} onLayout={measureOrigin(gridOrigin)}>
        {days.map((d) => (
          <View
            key={d.day}
            onLayout={(e: LayoutChangeEvent) => {
              const { x, y, width, height } = e.nativeEvent.layout;
              // grid 기준 좌표 — 쏠 때 gridOrigin을 더해 카드 기준으로 바꾼다.
              cellPos.current[d.day] = { x: x + width / 2, y: y + height / 2 };
            }}>
            <AttendanceDayCell
              day={d.day}
              coinAmount={d.coinAmount}
              furnitureReward={d.furnitureReward}
              claimed={d.claimed}
              bonus={d.coinAmount > base}
              stampNow={stampedDay === d.day}
            />
          </View>
        ))}
      </View>

      <Button
        label={buttonLabel}
        onPress={press}
        disabled={checkingIn || status.checkedInToday || status.completed}
      />

      {coin ? (
        <FlyingCoin
          key={coin.id}
          x={coin.x}
          y={coin.y}
          tx={headOrigin.current.x + walletPos.current.x}
          ty={headOrigin.current.y + walletPos.current.y}
          onDone={() => setCoin(null)}
        />
      ) : null}

      {trophy ? (
        <AttendanceTrophyReveal
          name={trophy.name}
          assetKey={trophy.assetKey}
          onGoToRoom={onGoToRoom}
          onClose={() => setTrophy(null)}
        />
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: Spacing.three, gap: Spacing.two },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1 },
  walletPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  streakRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
