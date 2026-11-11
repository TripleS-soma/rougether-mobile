import { useEffect } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { AttendanceCheckInResult, AttendanceStatus } from '@/api/events';
import { ChristmasModalFrame } from '@/components/screens/christmas/christmas-modal-frame';
import { CharacterAvatar } from '@/components/room/character-avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Radius, Spacing, TabularNums } from '@/constants/theme';
import { useAnimatedValue, useLatestRef } from '@/hooks/use-stable-value';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
import { NATIVE_DRIVER } from '@/utils/animation';

export const CHRISTMAS_REWARD_SETTLE_MS = 1100;

function GiftEnvelope({ day, claimed, next }: { day: number; claimed: boolean; next: boolean }) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  return (
    <View
      accessible
      accessibilityLabel={tr(claimed ? 'christmas.dayClaimed' : 'christmas.dayClosed', { day })}
      style={[styles.envelope, next && { backgroundColor: t.primarySoft }]}>
      <Svg width="100%" height="100%" viewBox="0 0 72 66" style={StyleSheet.absoluteFill}>
        {claimed ? <Path d="M5 25 L36 3 L67 25" fill={t.success} /> : null}
        <Rect
          x="5"
          y="23"
          width="62"
          height="40"
          rx="7"
          fill={t.surfaceMuted}
          stroke={next ? t.primary : t.border}
          strokeWidth={next ? 2 : 1}
        />
        {claimed ? (
          <>
            <Path d="M25 18 H48 V38 H25 Z" fill={t.warning} />
            <Path d="M36 18 V38 M25 27 H48" stroke={t.danger} strokeWidth="4" />
            <Path d="M6 34 L36 50 L66 34 L66 57 Q66 62 60 62 H12 Q6 62 6 57 Z" fill={t.surface} />
          </>
        ) : (
          <>
            <Path d="M7 24 H65 L40 40 Q36 43 32 40 Z" fill={t.success} />
            <Circle cx="36" cy="39" r="4" fill={t.danger} />
          </>
        )}
        {day === 30 ? (
          <Path
            d="M36 25 C13 9 10 32 33 29 C13 44 21 50 36 31 C51 50 59 44 39 29 C62 32 59 9 36 25 Z"
            fill={t.danger}
          />
        ) : null}
      </Svg>
      <Text
        style={[
          Typography.label,
          emph('semibold'),
          styles.dayNumber,
          TabularNums,
          { color: t.text },
        ]}>
        {day}
      </Text>
    </View>
  );
}

export type ChristmasAttendanceModalProps = {
  visible: boolean;
  status: AttendanceStatus | null;
  loading?: boolean;
  error?: boolean | string;
  checkingIn?: boolean;
  claimingCharacter?: boolean;
  onClaimCharacter?: () => void | Promise<unknown>;
  result?: AttendanceCheckInResult | null;
  onCheckIn: () => void | Promise<unknown>;
  onClose: () => void;
  onDismissed: () => void;
  onRetry: () => void;
  onGoGacha?: () => void;
};

/** Thirty cumulative envelopes. Only server progress opens an envelope. */
export function ChristmasAttendanceModal({
  visible,
  status,
  loading = false,
  error = false,
  checkingIn = false,
  claimingCharacter = false,
  onClaimCharacter,
  result,
  onCheckIn,
  onClose,
  onDismissed,
  onRetry,
  onGoGacha,
}: ChristmasAttendanceModalProps) {
  const tr = useT();
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const onCloseRef = useLatestRef(onClose);
  const rewardRise = useAnimatedValue(0);
  const progress = Math.max(0, Math.min(30, status?.progressDays ?? 0));
  const success = !!result?.newCheckIn;
  const canCheckIn =
    !!status?.availableToday &&
    status.active !== false &&
    !status.completed &&
    !status.checkedInToday &&
    progress < 30;
  const reward = status?.dailyRewards.find((day) => day.day === progress + 1);
  const endsLabel = status?.endsOn
    ? tr('christmas.endsOn', { date: status.endsOn.slice(5).replace('-', '.') })
    : null;

  useEffect(() => {
    if (!visible || !result?.status.checkedInToday) return;
    if (result.newCheckIn && result.coinRewardAmount > 0) {
      rewardRise.setValue(0);
      Animated.timing(rewardRise, {
        toValue: 1,
        duration: 400,
        useNativeDriver: NATIVE_DRIVER,
      }).start();
    }
    // Idempotent recovery closes without pretending to award coins again.
    const timer = setTimeout(
      () => onCloseRef.current(),
      result.newCheckIn ? (result.characterGrantedNow ? 2600 : CHRISTMAS_REWARD_SETTLE_MS) : 0,
    );
    return () => {
      clearTimeout(timer);
      rewardRise.stopAnimation();
    };
  }, [visible, result, onCloseRef, rewardRise]);

  const busy = checkingIn || claimingCharacter || success;
  const close = () => {
    if (!busy) onClose();
  };
  const buttonLabel = checkingIn
    ? tr('christmas.checkingIn')
    : status?.completed || progress >= 30
      ? tr('christmas.completed')
      : status?.active === false
        ? tr('christmas.ended')
        : status?.checkedInToday
          ? tr('christmas.checkedIn')
          : tr('christmas.checkIn');

  return (
    <ChristmasModalFrame
      visible={visible}
      label={tr('christmas.title')}
      onClose={close}
      onDismissed={onDismissed}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[Typography.h2, emph('bold'), { color: t.text }]}>
            {tr('christmas.title')}
          </Text>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={tr('christmas.close')}
            disabled={busy}
            onPress={close}
            style={styles.close}>
            <Icon name="close" size={24} color={t.text} />
          </ScalePressable>
        </View>
        <View style={[styles.tabs, { borderColor: t.border }]}>
          <View style={[styles.tab, { backgroundColor: t.success }]}>
            <Text style={[Typography.label, { color: t.onPrimary }]}>
              {tr('christmas.attendance')}
            </Text>
          </View>
          <ScalePressable
            accessibilityRole="button"
            disabled={!onGoGacha || busy}
            onPress={onGoGacha}
            style={styles.tab}>
            <Text style={[Typography.label, { color: t.textMuted }]}>{tr('christmas.gacha')}</Text>
          </ScalePressable>
        </View>
        {loading ? (
          <ActivityIndicator accessibilityLabel={tr('christmas.loading')} color={t.primary} />
        ) : null}
        {status ? (
          <>
            <View style={styles.summary}>
              <Text style={[Typography.h3, emph('bold'), TabularNums, { color: t.text }]}>
                {progress} / 30
              </Text>
              {endsLabel ? (
                <Text style={[Typography.supporting, { color: t.textMuted }]}>{endsLabel}</Text>
              ) : null}
            </View>
            <View style={[styles.board, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={styles.boardBow}>
                <Icon name="gift" size={24} color={t.danger} />
              </View>
              <View style={styles.grid}>
                {Array.from({ length: 30 }, (_, index) => (
                  <GiftEnvelope
                    key={index}
                    day={index + 1}
                    claimed={index < progress}
                    next={canCheckIn && index === progress}
                  />
                ))}
              </View>
            </View>
            {status.characterReward ? (
              <View
                style={[
                  styles.characterReward,
                  { backgroundColor: t.primarySoft, borderColor: t.border },
                ]}>
                <CharacterAvatar characterId="fox" size={76} animate />
                <View style={styles.characterRewardDetails}>
                  <Text style={[Typography.label, emph('semibold'), { color: t.text }]}>
                    {tr('christmas.foxRewardTitle', { day: status.characterReward.day })}
                  </Text>
                  {status.characterReward.received ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={[Typography.supporting, { color: t.success }]}>
                      {tr('christmas.characterReceivedBadge')}
                    </Text>
                  ) : status.characterReward.claimable && onClaimCharacter ? (
                    <Button
                      label={tr(
                        claimingCharacter
                          ? 'christmas.claimingCharacter'
                          : 'christmas.claimCharacter',
                      )}
                      disabled={busy || loading}
                      variant="secondary"
                      onPress={() => {
                        void onClaimCharacter();
                      }}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
            {success && result.coinRewardAmount > 0 ? (
              <Animated.View
                accessibilityLiveRegion="polite"
                style={[
                  styles.reward,
                  {
                    opacity: rewardRise,
                    transform: [
                      {
                        translateY: rewardRise.interpolate({
                          inputRange: [0, 1],
                          outputRange: [Spacing.two, 0],
                        }),
                      },
                    ],
                  },
                ]}>
                <Icon name="coin" size={22} color={t.warning} />
                <Text style={[Typography.h3, emph('bold'), { color: t.text }]}>
                  {tr('christmas.coinReceived', { amount: result.coinRewardAmount })}
                </Text>
              </Animated.View>
            ) : reward && canCheckIn ? (
              <View style={styles.reward}>
                <Icon name="coin" size={18} color={t.warning} />
                <Text style={[Typography.supporting, { color: t.text }]}>
                  {tr('christmas.todayReward', { amount: reward.coinAmount })}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
        {error ? (
          <View style={styles.error}>
            <Text
              accessibilityLiveRegion="polite"
              style={[Typography.supporting, styles.centerText, { color: t.danger }]}>
              {tr('christmas.loadError')}
            </Text>
            <Button
              label={tr('christmas.retry')}
              variant="secondary"
              disabled={checkingIn || loading}
              onPress={onRetry}
            />
          </View>
        ) : null}
        {status ? (
          <Button
            label={buttonLabel}
            disabled={!canCheckIn || busy || loading}
            onPress={() => {
              void onCheckIn();
            }}
          />
        ) : null}
      </ScrollView>
    </ChristmasModalFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { padding: Spacing.two },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.pill, overflow: 'hidden' },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  board: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.two },
  boardBow: { alignItems: 'center', marginBottom: Spacing.one },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.one,
  },
  envelope: {
    width: '19%',
    aspectRatio: 1.05,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderRadius: Radius.sm,
  },
  dayNumber: { paddingBottom: Spacing.half },
  centerText: { textAlign: 'center' },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 24,
  },
  characterReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },
  characterRewardDetails: { flex: 1, gap: Spacing.one },
  error: { gap: Spacing.two },
});
