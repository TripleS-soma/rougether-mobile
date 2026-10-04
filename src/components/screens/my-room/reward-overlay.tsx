import { type Ref, type RefObject, useImperativeHandle } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { type FlyOrigin, useRewardFly } from '@/components/screens/my-room/use-reward-fly';
import { FlyingCoin } from '@/components/ui/flying-coin';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type RewardOverlayHandle = {
  /** 보상을 띄운다 — 알약(코인 합산)과 탭 지점에서 알약으로 나는 코인. */
  show: (coins: number, from: FlyOrigin | null) => void;
};

/**
 * 완료 보상 알약·코인 플라이 (#440 → #1055) — 나의 방 화면에서 떼어낸 층 (성능 장부 R4).
 *
 * 보상 상태가 화면 루트에 있어서 완료 한 번에 화면 전체(루틴 목록·방·달력·시트)가 한 번 더
 * 그려졌다. 상태를 이 층으로 옮기고 화면은 `ref.show()`만 부른다 — 보상이 떠도 다시 그려지는
 * 건 이 층뿐이다. 표시 규칙은 `useRewardFly` 그대로.
 */
export function RewardOverlay({
  ref,
  rootRef,
  streakDays,
  top,
}: {
  ref: Ref<RewardOverlayHandle>;
  /** 화면 루트 — 코인 좌표를 루트 기준으로 바꾸는 데 쓴다. */
  rootRef: RefObject<View | null>;
  streakDays: number;
  /** 알약 위치(화면 위에서부터). */
  top: number;
}) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const {
    rewardPillRef,
    rewardPulse,
    streakPulse,
    flyingCoins,
    reward,
    showReward,
    measureRewardPill,
    onCoinArrive,
  } = useRewardFly(streakDays, rootRef);
  useImperativeHandle(ref, () => ({ show: showReward }), [showReward]);

  return (
    <>
      {/* 보상 알약 (#1055) — 완료 보상이 확인된 순간에만 크롬 아래 가운데에 떠서
          스트릭·코인 증분을 보여주고 사라진다. 코인 플라이의 목적지. */}
      {reward ? (
        <View pointerEvents="none" style={[styles.rewardWrap, { top }]}>
          <Animated.View
            ref={rewardPillRef}
            onLayout={measureRewardPill}
            style={{ transform: [{ scale: rewardPulse }] }}>
            <GlassSurface interactive={false} fallbackColor={t.surface} style={styles.rewardPill}>
              {/* A 0-day streak is nothing to celebrate — show the flame only
                  once a streak exists. */}
              {streakDays > 0 ? (
                <Animated.View style={[styles.streak, { transform: [{ scale: streakPulse }] }]}>
                  <Icon name="flame" size={14} color={t.warningText} />
                  <Text style={[Typography.label, { color: t.warningText }]}>
                    {tr('routineTodo.myRoom.streakDays', { days: streakDays })}
                  </Text>
                </Animated.View>
              ) : null}
              <View style={styles.streak}>
                <Icon name="coin" size={14} color={t.warning} />
                <Text style={[Typography.label, { color: t.text }]}>+{reward.coins}</Text>
              </View>
            </GlassSurface>
          </Animated.View>
        </View>
      ) : null}
      {/* 완료 보상 코인 플라이 오버레이 (#440) — 탭 지점 → 보상 알약. */}
      {flyingCoins.map((c) => (
        <FlyingCoin key={c.id} {...c} onDone={() => onCoinArrive(c.id)} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  rewardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
});
