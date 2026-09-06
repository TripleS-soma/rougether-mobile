import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DrawResult } from '@/api';
import type { GachaMachine } from '@/api/adapters';
import { GiftBoxArt } from '@/components/screens/gacha/gift-box-art';
import { Icon } from '@/components/ui/icon';
import { Pictogram } from '@/components/ui/pictograms';
import { GachaStage as Stage, Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useAnimatedValue, useStableCallback } from '@/hooks/use-stable-value';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';
import { RARITY_COLORS, type Rarity } from '@/resources/furniture';
import { hapticImpact, hapticSelection } from '@/utils/haptics';

export const MIN_CHARGE_MS = 1800;
export const BURST_MS = 550;
export const DEFAULT_RARITY: Rarity = '일반';
export const rarityColor = (rarity?: string) =>
  RARITY_COLORS[(rarity as Rarity) ?? DEFAULT_RARITY] ?? RARITY_COLORS[DEFAULT_RARITY];

const SPARKLES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * Math.PI) / 6;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

/** Squash, hop, then accelerating wiggle. Keep the selected box recognizable. */
export function ChargingBox({
  machine,
  reducedMotion = false,
}: {
  machine?: GachaMachine;
  reducedMotion?: boolean;
}) {
  const t = useTokens();
  const charge = useAnimatedValue(0);
  const bounce = useAnimatedValue(0);
  const shake = useAnimatedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    const build = Animated.timing(charge, {
      toValue: 1,
      duration: MIN_CHARGE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    const hops = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    );
    const wiggle = Animated.sequence(
      [260, 200, 140, 100, 80].flatMap((duration, i) => [
        Animated.timing(shake, { toValue: (i + 1) / 5, duration, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -(i + 1) / 5, duration, useNativeDriver: true }),
      ]),
    );
    build.start();
    hops.start();
    wiggle.start();
    // A short rhythm, not endless vibration on a slow connection.
    const beats = [520, 1060, 1520].map((delay) => setTimeout(hapticSelection, delay));
    return () => {
      build.stop();
      hops.stop();
      wiggle.stop();
      beats.forEach(clearTimeout);
    };
  }, [charge, bounce, shake, reducedMotion]);
  return (
    <View style={styles.stage} testID="gacha-charge">
      <Animated.View
        style={[
          styles.halo,
          {
            backgroundColor: t.primary,
            opacity: charge.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.3] }),
            transform: [
              { scale: bounce.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] }) },
            ],
          },
        ]}
      />
      {!reducedMotion &&
        SPARKLES.filter((_, i) => i % 2 === 0).map((point, i) => (
          <Animated.View
            key={i}
            style={[
              styles.sparkle,
              {
                backgroundColor: i % 2 ? t.primary : t.warning,
                opacity: charge.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 1] }),
                transform: [
                  {
                    translateX: charge.interpolate({
                      inputRange: [0, 1],
                      outputRange: [point.x * Stage.orbit * 1.4, point.x * Stage.orbit],
                    }),
                  },
                  {
                    translateY: charge.interpolate({
                      inputRange: [0, 1],
                      outputRange: [point.y * Stage.orbit * 1.4, point.y * Stage.orbit],
                    }),
                  },
                  { rotate: '45deg' },
                  { scale: bounce.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) },
                ],
              },
            ]}
          />
        ))}
      <Animated.View
        style={[
          styles.chargeBox,
          {
            backgroundColor: machine?.accent ?? t.surfaceMuted,
            transform: [
              {
                translateY: bounce.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0, Spacing.one, -Spacing.four],
                }),
              },
              { scale: charge.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) },
              {
                scaleY: bounce.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [1, 0.92, 1.06],
                }),
              },
              {
                rotate: shake.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ['-10deg', '10deg'],
                }),
              },
            ],
          },
        ]}>
        {machine ? (
          <GiftBoxArt machine={machine} size={Stage.boxArt} testIDPrefix="charging-gift-box" />
        ) : (
          <Pictogram name="gift" size={Spacing.six} />
        )}
      </Animated.View>
    </View>
  );
}

/** Localized rings and confetti, never a full-screen white flash. */
export function BurstOverlay({
  color,
  strong,
  celebration = false,
}: {
  color: string;
  strong: boolean;
  celebration?: boolean;
}) {
  const t = useTokens();
  const p = useAnimatedValue(0);
  useEffect(() => {
    const animation = Animated.timing(p, {
      toValue: 1,
      duration: celebration ? 1800 : BURST_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [p, celebration]);
  const colors = [color, t.primary, t.warning, StaticWhite];
  return (
    <View
      style={styles.stage}
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="gacha-burst">
      {[0, 1].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.burstRing,
            {
              borderColor: color,
              opacity: p.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] }),
              transform: [
                {
                  scale: p.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, (strong ? 1.8 : 1.3) + i * 0.4],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      {SPARKLES.map((point, i) => (
        <Animated.View
          key={i}
          style={[
            styles.sparkle,
            i % 2 === 0 && styles.confetti,
            {
              backgroundColor: colors[i % colors.length],
              opacity: p.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
              transform: [
                {
                  translateX: p.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, point.x * Stage.size * (strong ? 0.9 : 0.65)],
                  }),
                },
                {
                  translateY: p.interpolate({
                    inputRange: [0, 0.55, 1],
                    outputRange: [
                      0,
                      point.y * Stage.size * 0.6,
                      point.y * Stage.size * 0.6 + (celebration ? Stage.size : Spacing.four),
                    ],
                  }),
                },
                {
                  rotate: p.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${i % 2 ? 240 : -180}deg`],
                  }),
                },
                {
                  scale: p.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0.4, strong ? 1.4 : 1, 0.6],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function RewardContent({ item, large = false }: { item: DrawResult; large?: boolean }) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const color = rarityColor(item.rarity);
  return (
    <>
      {isCdnKey(item.assetKey) ? (
        <Image
          source={assetSource(item.assetKey)}
          style={large ? styles.heroArt : styles.art}
          contentFit="contain"
        />
      ) : (
        <Icon name="gift" size={large ? Spacing.six : Spacing.five} color={color} />
      )}
      {item.rarity ? (
        <Text
          style={[
            Typography.supporting,
            emph('bold'),
            styles.badge,
            { backgroundColor: color, color: StaticWhite },
          ]}>
          {item.rarity}
        </Text>
      ) : null}
      <Text
        style={[large ? Typography.label : Typography.supporting, styles.center, { color: t.text }]}
        numberOfLines={2}>
        {item.name ?? '보상'}
      </Text>
      <Text
        style={[
          Typography.supporting,
          emph('semibold'),
          styles.center,
          { color: item.converted ? t.textMuted : t.primaryActive },
        ]}>
        {item.converted
          ? `중복 · ${item.refundCurrencyType === 'COIN' ? '코인' : '다이아'} +${item.refundAmount ?? 0}`
          : '새 선물!'}
      </Text>
    </>
  );
}

/** The reward springs out of the box rather than dropping from off-screen. */
export function RevealCard({
  item,
  index,
  large,
  reducedMotion = false,
}: {
  item: DrawResult;
  index: number;
  large?: boolean;
  reducedMotion?: boolean;
}) {
  const t = useTokens();
  const p = useAnimatedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) {
      p.setValue(1);
      return;
    }
    const animation = Animated.spring(p, {
      toValue: 1,
      delay: index * 120,
      damping: 11,
      stiffness: 150,
      mass: 0.8,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [p, index, reducedMotion]);
  return (
    <Animated.View
      style={[
        styles.revealCard,
        large && styles.heroCard,
        {
          backgroundColor: t.surface,
          borderColor: rarityColor(item.rarity),
          opacity: p,
          transform: [
            { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) },
            { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [Spacing.five, 0] }) },
          ],
        },
      ]}>
      <RewardContent item={item} large={large} />
    </Animated.View>
  );
}

export const AUTO_REVEAL_MS = 1100;
export const REVEAL_STAGGER_MS = 320;

/** Auto-open at a readable pace. Tapping or revealAll never draws again. */
export function FlipCard({
  item,
  index,
  revealAll = false,
  reducedMotion = false,
  onReveal,
  width = Stage.card,
}: {
  item: DrawResult;
  index: number;
  revealAll?: boolean;
  reducedMotion?: boolean;
  onReveal?: (index: number) => void;
  width?: number;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const deal = useAnimatedValue(reducedMotion ? 1 : 0);
  const flip = useAnimatedValue(reducedMotion ? 1 : 0);
  const [flipped, setFlipped] = useState(reducedMotion);
  const opened = useRef(false);
  const runFlip = useStableCallback(() => {
    if (opened.current) return;
    opened.current = true;
    setFlipped(true);
    onReveal?.(index);
    if (reducedMotion) {
      flip.setValue(1);
      return;
    }
    if (!revealAll) {
      if (item.rarity === '전설') hapticImpact();
      else hapticSelection();
    }
    Animated.timing(flip, {
      toValue: 1,
      duration: 460,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  });
  useEffect(() => {
    if (reducedMotion) {
      deal.setValue(1);
      return;
    }
    const animation = Animated.spring(deal, {
      toValue: 1,
      delay: index * 70,
      damping: 15,
      stiffness: 160,
      mass: 0.8,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [deal, index, reducedMotion]);
  useEffect(() => {
    if (revealAll || reducedMotion) {
      runFlip();
      return;
    }
    const timer = setTimeout(runFlip, AUTO_REVEAL_MS + index * REVEAL_STAGGER_MS);
    return () => clearTimeout(timer);
  }, [index, revealAll, reducedMotion, runFlip]);
  useEffect(() => () => flip.stopAnimation(), [flip]);
  return (
    <Animated.View
      style={[
        styles.flipWrap,
        { width },
        {
          opacity: deal,
          transform: [
            { translateY: deal.interpolate({ inputRange: [0, 1], outputRange: [Spacing.six, 0] }) },
            {
              scale: flip.interpolate({
                inputRange: [0, 0.5, 0.8, 1],
                outputRange: [1, 1.07, 1.04, 1],
              }),
            },
          ],
        },
      ]}>
      {!reducedMotion && item.rarity === '전설' ? (
        <Animated.View
          pointerEvents="none"
          aria-hidden
          style={[
            styles.cardGlow,
            {
              backgroundColor: rarityColor(item.rarity),
              opacity: flip.interpolate({
                inputRange: [0, 0.5, 0.75, 1],
                outputRange: [0, 0, 0.6, 0.18],
              }),
              transform: [
                {
                  scale: flip.interpolate({
                    inputRange: [0, 0.5, 0.75, 1],
                    outputRange: [1, 1, 1.06, 1],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      <Pressable
        onPress={runFlip}
        disabled={flipped}
        accessibilityRole="button"
        accessibilityLabel={flipped ? (item.name ?? '보상') : `${index + 1}번째 카드 뒤집기`}
        accessibilityState={{ disabled: flipped }}
        style={styles.flipInner}>
        <Animated.View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.flipFace,
            {
              backgroundColor: t.primary,
              borderColor: t.primaryActive,
              opacity: flip.interpolate({
                inputRange: [0, 0.49, 0.5, 1],
                outputRange: [1, 1, 0, 0],
              }),
              transform: [
                { perspective: 850 },
                {
                  rotateY: flip.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }),
                },
              ],
            },
          ]}>
          <Pictogram name="gift" size={Spacing.five} />
          <Text style={[Typography.supporting, { color: t.onPrimary }]}>두근두근</Text>
          <Text style={[Typography.supporting, { color: t.onPrimary }]}>{index + 1}</Text>
        </Animated.View>
        <Animated.View
          aria-hidden={!flipped}
          accessibilityElementsHidden={!flipped}
          importantForAccessibility={flipped ? 'auto' : 'no-hide-descendants'}
          style={[
            styles.flipFace,
            {
              backgroundColor: t.surface,
              borderColor: rarityColor(item.rarity),
              opacity: flip.interpolate({
                inputRange: [0, 0.49, 0.5, 1],
                outputRange: [0, 0, 1, 1],
              }),
              transform: [
                { perspective: 850 },
                {
                  rotateY: flip.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['180deg', '360deg'],
                  }),
                },
              ],
            },
          ]}>
          <RewardContent item={item} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  stage: { width: Stage.size, height: Stage.size, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: Stage.halo, height: Stage.halo, borderRadius: Radius.pill },
  chargeBox: {
    width: Stage.box,
    height: Stage.box,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    width: Stage.particle,
    height: Stage.particle,
    borderRadius: Spacing.half,
  },
  confetti: { height: Stage.particle * 2, borderRadius: Spacing.half },
  burstRing: {
    position: 'absolute',
    width: Stage.halo,
    height: Stage.halo,
    borderRadius: Radius.pill,
    borderWidth: Spacing.half,
  },
  revealCard: {
    width: Stage.card,
    borderRadius: Radius.lg,
    borderWidth: Spacing.half,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  heroCard: { width: Stage.hero, padding: Spacing.four, gap: Spacing.two },
  art: { width: Stage.art, height: Stage.art },
  heroArt: { width: Stage.heroArt, height: Stage.heroArt },
  badge: {
    overflow: 'hidden',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  flipWrap: { width: Stage.card, height: Stage.cardHeight },
  flipInner: { flex: 1 },
  cardGlow: { ...StyleSheet.absoluteFillObject, margin: -Spacing.half, borderRadius: Radius.md },
  flipFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.md,
    borderWidth: Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.two,
    backfaceVisibility: 'hidden',
  },
});
