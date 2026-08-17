import { useEffect } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
// 뽑기 버스트를 그대로 빌린다 (#851) — 완주 보상도 "귀한 걸 받았다"는 같은
// 사건이라 같은 시각 문법을 쓰는 게 맞다. 새 연출을 또 만들 이유가 없다.
import { BurstOverlay } from '@/components/screens/gacha/draw-animation';
import { Radius, Spacing } from '@/constants/theme';
import { assetSource } from '@/resources/asset';
import { useAnimatedValue } from '@/hooks/use-stable-value';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

export type AttendanceTrophyRevealProps = {
  name: string;
  assetKey?: string;
  /** '방에 배치하러 가기' — 없으면 버튼을 숨긴다. */
  onGoToRoom?: () => void;
  onClose?: () => void;
};

/**
 * 완주 보상 리빌 (#851) — 10일차를 채워 보상 가구를 **이번에** 받았을 때만
 * 뜬다. 이미 보유한 가구로 완료된 경우(`rewardGrantedNow=false`)는 새로 받은
 * 게 없으므로 띄우지 않는다.
 */
export function AttendanceTrophyReveal({
  name,
  assetKey,
  onGoToRoom,
  onClose,
}: AttendanceTrophyRevealProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const pop = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(pop, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.back(1.8)),
      useNativeDriver: true,
    }).start();
  }, [pop]);

  return (
    <View style={[styles.overlay, { backgroundColor: t.screen }]} testID="attendance-trophy-reveal">
      <View style={styles.burstSlot}>
        <BurstOverlay color={t.warning} strong />
        <Animated.View
          style={[
            styles.trophy,
            {
              backgroundColor: t.surfaceMuted,
              opacity: pop,
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              ],
            },
          ]}>
          {assetKey ? (
            <Image source={assetSource(assetKey)} style={styles.art} resizeMode="contain" />
          ) : null}
        </Animated.View>
      </View>
      <Text style={[Typography.h2, emph('bold'), styles.center, { color: t.text }]}>
        {name} 획득!
      </Text>
      <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
        10일 연속 출석을 채웠어요.
      </Text>
      <View style={styles.actions}>
        {onGoToRoom ? <Button label="방에 배치하러 가기" onPress={onGoToRoom} /> : null}
        <Button label="닫기" variant="secondary" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.lg,
  },
  burstSlot: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  trophy: {
    width: 128,
    height: 128,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: { width: '100%', height: '100%' },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: Spacing.two, marginTop: Spacing.two },
});
