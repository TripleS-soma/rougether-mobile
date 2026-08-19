import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DrawResult } from '@/api';
import type { GachaMachine } from '@/api/adapters';
import { GiftBoxArt } from '@/components/screens/gacha/gift-box-art';
import { Icon } from '@/components/ui/icon';
import { Pictogram } from '@/components/ui/pictograms';
import { Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { assetSource, isCdnKey } from '@/resources/asset';
import { RARITY_COLORS, type Rarity } from '@/resources/furniture';
import { useAnimatedValue } from '@/hooks/use-stable-value';

/** Minimum charge-phase duration — keeps the build-up on screen even when the
 * draw API answers in a few hundred ms. */
export const MIN_CHARGE_MS = 1800;
/** Burst transition (#431) — flash → rays/particles, then the reveal lands. */
export const BURST_MS = 650;
/** 기본 레어도 — rarity가 없는(또는 미지의) 아이템의 뱃지·색 폴백. */
export const DEFAULT_RARITY: Rarity = '일반';

/** 아이템 rarity 문자열 → 뱃지/버스트 색. 미지정·미지의 값은 기본 레어도 색. */
export const rarityColor = (rarity?: string) =>
  RARITY_COLORS[(rarity as Rarity) ?? DEFAULT_RARITY] ?? RARITY_COLORS[DEFAULT_RARITY];

/**
 * Animated box shown during the charge phase (#431): the shake escalates —
 * amplitude grows while the period shrinks over MIN_CHARGE_MS, then holds an
 * intense loop until the burst. The growing tension makes the same 1.8s read
 * far more dramatic than the old uniform wobble.
 */
export function ChargingBox({ machine }: { machine?: GachaMachine }) {
  const t = useTokens();
  const grow = useAnimatedValue(0);
  const shake = useAnimatedValue(0);
  const glow = useAnimatedValue(0);

  useEffect(() => {
    // 진폭↑·주기↓ 에스컬레이션 (~1760ms) 후 최고 강도 루프 유지.
    const steps: { amp: number; dur: number; reps: number }[] = [
      { amp: 1, dur: 280, reps: 1 },
      { amp: 1.7, dur: 200, reps: 1 },
      { amp: 2.4, dur: 150, reps: 2 },
      { amp: 3, dur: 100, reps: 1 },
    ];
    const seq: Animated.CompositeAnimation[] = [];
    for (const s of steps)
      for (let i = 0; i < s.reps; i++)
        seq.push(
          Animated.timing(shake, { toValue: s.amp, duration: s.dur, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -s.amp, duration: s.dur, useNativeDriver: true }),
        );
    const intense = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 3.4, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -3.4, duration: 70, useNativeDriver: true }),
      ]),
    );
    const escalate = Animated.sequence(seq);
    escalate.start(({ finished }) => finished && intense.start());
    const growAnim = Animated.timing(grow, {
      toValue: 1,
      duration: MIN_CHARGE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    growAnim.start();
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]),
    );
    glowLoop.start();
    return () => {
      escalate.stop();
      intense.stop();
      growAnim.stop();
      glowLoop.stop();
    };
  }, [grow, shake, glow]);

  const boxStyle = {
    transform: [
      { scale: grow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) },
      { rotate: shake.interpolate({ inputRange: [-3.4, 3.4], outputRange: ['-12deg', '12deg'] }) },
    ],
  };
  const glowStyle = {
    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] }),
    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }],
  };

  return (
    <View style={styles.chargeWrap}>
      <Animated.View style={[styles.glowRing, glowStyle, { backgroundColor: t.primary }]} />
      <Animated.View
        style={[
          styles.chargeBox,
          boxStyle,
          { backgroundColor: machine?.accent ?? t.surfaceMuted },
        ]}>
        {machine ? (
          // 선택 카드(boxHero 120 안에 96)와 **같은 비율·같은 아트**. 여기서
          // 픽토그램으로 바뀌면 방금 고른 그 상자를 여는 것으로 안 읽힌다.
          <GiftBoxArt machine={machine} size={96} testIDPrefix="charging-gift-box" />
        ) : (
          <Pictogram name="gift" size={56} />
        )}
      </Animated.View>
    </View>
  );
}

/** 파티클 비산 좌표 — 버스트 중심에서 바깥으로 (#431). */
const BURST_PARTICLES = [
  { dx: -84, dy: -100 },
  { dx: 88, dy: -74 },
  { dx: -100, dy: 32 },
  { dx: 96, dy: 56 },
  { dx: -44, dy: -126 },
  { dx: 52, dy: -122 },
];

/**
 * Peak-moment burst (#431): white flash → rarity-colored rays + expanding ring
 * + particles. `strong` (희귀 이상) lengthens the rays and doubles particles;
 * 일반 keeps it short so the rarity difference is felt.
 */
export function BurstOverlay({ color, strong }: { color: string; strong: boolean }) {
  const t = useTokens();
  const p = useAnimatedValue(0);

  useEffect(() => {
    Animated.timing(p, {
      toValue: 1,
      duration: BURST_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [p]);

  const flashStyle = {
    opacity: p.interpolate({ inputRange: [0, 0.12, 0.32, 1], outputRange: [0.95, 0.65, 0, 0] }),
  };
  const ringStyle = {
    opacity: p.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.8, 0.15, 0] }),
    transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2] }) }],
  };
  const rayOpacity = p.interpolate({
    inputRange: [0, 0.2, 0.75, 1],
    outputRange: [0, 0.95, 0.35, 0],
  });
  const rayScale = p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.1, 1, 1.15] });
  const particles = strong ? BURST_PARTICLES : BURST_PARTICLES.slice(0, 3);
  const particleColors = [color, t.warning, t.primary];

  return (
    <View style={styles.burstWrap} pointerEvents="none" testID="gacha-burst">
      <Animated.View style={[styles.flash, flashStyle]} />
      {[0, 45, 90, 135].map((deg) => (
        <Animated.View
          key={deg}
          style={[
            styles.ray,
            { height: strong ? 260 : 150, backgroundColor: color, opacity: rayOpacity },
            { transform: [{ rotate: `${deg}deg` }, { scaleY: rayScale }] },
          ]}
        />
      ))}
      <Animated.View style={[styles.burstRing, ringStyle, { borderColor: color }]} />
      {particles.map((pt, i) => (
        <Animated.View
          key={`${pt.dx}-${pt.dy}`}
          style={[
            styles.particle,
            {
              backgroundColor: particleColors[i % particleColors.length],
              opacity: p.interpolate({
                inputRange: [0, 0.15, 0.85, 1],
                outputRange: [0, 1, 0.6, 0],
              }),
              transform: [
                { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, pt.dx] }) },
                { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, pt.dy] }) },
                { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Single-pull hero card (#431): slams down from above with a bounce — the
 * burst's momentum carries straight into the reward landing. */
export function RevealCard({
  item,
  index,
  large,
}: {
  item: DrawResult;
  index: number;
  large?: boolean;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const p = useAnimatedValue(0);
  const fade = useAnimatedValue(0);
  const color = rarityColor(item.rarity);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(p, {
        toValue: 1,
        duration: 620,
        delay: index * 120,
        easing: Easing.bounce,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 160,
        delay: index * 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [p, fade, index]);

  const style = {
    opacity: fade,
    transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-180, 0] }) }],
  };

  return (
    <Animated.View
      style={[
        styles.revealCard,
        large && styles.revealCardLarge,
        style,
        { backgroundColor: t.surface, borderColor: color },
      ]}>
      {isCdnKey(item.assetKey) ? (
        <Image
          source={assetSource(item.assetKey)}
          style={large ? styles.revealArtLarge : styles.revealArt}
          contentFit="contain"
          transition={120}
        />
      ) : (
        <Icon name="gift" size={large ? 72 : 34} color={color} />
      )}
      <Text style={[styles.revealBadge, emph('bold'), { backgroundColor: color }]}>
        {item.rarity ?? DEFAULT_RARITY}
      </Text>
      <Text style={[Typography.supporting, styles.center, { color: t.text }]} numberOfLines={2}>
        {item.name}
      </Text>
      {item.converted ? (
        <Text style={[styles.convertNote, emph('normal'), { color: t.textMuted }]}>
          중복 · 다이아 +{item.refundAmount ?? 0}
        </Text>
      ) : null}
    </Animated.View>
  );
}

/** 뒷면 카드가 깔린 뒤 자동 플립되는 간격 — 탭하면 그 카드는 즉시 뒤집힌다. */
const FLIP_DEAL_MS = 300;
const FLIP_STAGGER_MS = 70;
const FLIP_AUTO_BASE_MS = 500;
const FLIP_AUTO_STEP_MS = 110;

/**
 * 10연 reveal card (#431): deals in face-down from the top-right, then flips
 * on its own (staggered) or immediately on tap. 전설 cards leak a gold glow
 * before flipping so the good pull announces itself.
 */
export function FlipCard({ item, index }: { item: DrawResult; index: number }) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const deal = useAnimatedValue(0);
  const flip = useAnimatedValue(0);
  const glow = useAnimatedValue(0.3);
  const [flipped, setFlipped] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const color = rarityColor(item.rarity);
  const legend = item.rarity === '전설';

  const runFlip = () => {
    clearTimeout(autoTimer.current ?? undefined);
    setFlipped((was) => {
      if (!was)
        Animated.timing(flip, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start();
      return true;
    });
  };

  useEffect(() => {
    Animated.timing(deal, {
      toValue: 1,
      duration: FLIP_DEAL_MS,
      delay: index * FLIP_STAGGER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    autoTimer.current = setTimeout(
      runFlip,
      index * FLIP_STAGGER_MS + FLIP_DEAL_MS + FLIP_AUTO_BASE_MS + index * FLIP_AUTO_STEP_MS,
    );
    return () => clearTimeout(autoTimer.current ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회 딜·예약
  }, []);

  useEffect(() => {
    if (!legend || flipped) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [legend, flipped, glow]);

  const dealStyle = {
    opacity: deal,
    transform: [
      { translateX: deal.interpolate({ inputRange: [0, 1], outputRange: [140, 0] }) },
      { translateY: deal.interpolate({ inputRange: [0, 1], outputRange: [-200, 0] }) },
      { rotate: deal.interpolate({ inputRange: [0, 1], outputRange: ['14deg', '0deg'] }) },
    ],
  };
  const backStyle = {
    transform: [
      { perspective: 850 },
      { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) },
    ],
  };
  const frontStyle = {
    transform: [
      { perspective: 850 },
      { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) },
    ],
  };

  return (
    <Animated.View style={[styles.flipWrap, dealStyle]}>
      {legend && !flipped ? (
        <Animated.View style={[styles.flipGlow, { backgroundColor: color, opacity: glow }]} />
      ) : null}
      <Pressable
        onPress={runFlip}
        disabled={flipped}
        accessibilityRole="button"
        accessibilityLabel={flipped ? (item.name ?? '아이템') : `${index + 1}번째 카드 뒤집기`}
        style={styles.flipInner}>
        <Animated.View style={[styles.flipFace, backStyle, { backgroundColor: t.primary }]}>
          <Pictogram name="paw" size={34} />
        </Animated.View>
        <Animated.View
          style={[styles.flipFace, frontStyle, { backgroundColor: t.surface, borderColor: color }]}>
          {isCdnKey(item.assetKey) ? (
            <Image
              source={assetSource(item.assetKey)}
              style={styles.revealArt}
              contentFit="contain"
              transition={120}
            />
          ) : (
            <Icon name="gift" size={34} color={color} />
          )}
          <Text style={[styles.revealBadge, emph('bold'), { backgroundColor: color }]}>
            {item.rarity ?? DEFAULT_RARITY}
          </Text>
          <Text style={[Typography.supporting, styles.center, { color: t.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          {item.converted ? (
            <Text style={[styles.convertNote, emph('normal'), { color: t.textMuted }]}>
              중복 · 다이아 +{item.refundAmount ?? 0}
            </Text>
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },

  // Charging box (#431)
  chargeWrap: { alignItems: 'center', justifyContent: 'center', width: 200, height: 200 },
  glowRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  chargeBox: {
    width: 120,
    height: 120,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Reveal cards (#431)
  revealCardLarge: {
    width: 220,
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  revealArtLarge: {
    width: 150,
    height: 150,
  },
  revealCard: {
    width: 104,
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  revealArt: {
    width: 68,
    height: 68,
  },
  revealBadge: {
    color: StaticWhite,
    fontSize: 12,
    overflow: 'hidden',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
  },
  convertNote: { fontSize: 12, textAlign: 'center' },

  // Burst (#431)
  burstWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  flash: {
    ...StyleSheet.absoluteFillObject,
    top: -600,
    bottom: -600,
    left: -300,
    right: -300,
    backgroundColor: StaticWhite,
  },
  ray: { position: 'absolute', width: 5, borderRadius: 3 },
  burstRing: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 3 },
  particle: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },

  // 10연 flip reveal (#431)
  flipWrap: { width: 104, height: 158 },
  flipInner: { flex: 1 },
  flipGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: Radius.md,
  },
  flipFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    backfaceVisibility: 'hidden',
  },
});
