import { useEffect } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { GachaMachine } from '@/api/adapters';
import { GiftBoxArt } from '@/components/screens/gacha/gift-box-art';
import { Pictogram } from '@/components/ui/pictograms';
import { Radius, Spacing, StaticWhite } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { RewardArtwork, rarityColor } from '@/components/screens/gacha/reward-artwork';
import { useAnimatedValue } from '@/hooks/use-stable-value';
import { NATIVE_DRIVER } from '@/utils/animation';
import {
  getRevealMotionProfile,
  type RevealMotionProfile,
  type RevealPlanItem,
} from '@/components/screens/gacha/reveal-motion';

export { rarityColor, RewardArtwork } from '@/components/screens/gacha/reward-artwork';
export {
  CinematicRevealShell,
  CinematicRewardStage,
} from '@/components/screens/gacha/cinematic-reveal';

/** 파티클 비산 좌표 — 최대 전설 프로필까지 버스트 중심에서 바깥으로 비산한다. */
const BURST_PARTICLES = [
  { dx: -84, dy: -100 },
  { dx: 88, dy: -74 },
  { dx: -100, dy: 32 },
  { dx: 96, dy: 56 },
  { dx: -44, dy: -126 },
  { dx: 52, dy: -122 },
  { dx: -126, dy: -38 },
  { dx: 128, dy: -20 },
  { dx: -72, dy: 104 },
  { dx: 76, dy: 112 },
  { dx: -22, dy: 142 },
  { dx: 24, dy: -152 },
  { dx: -146, dy: 72 },
  { dx: 148, dy: 68 },
  { dx: -112, dy: -106 },
  { dx: 116, dy: -104 },
  { dx: -152, dy: 4 },
  { dx: 154, dy: 10 },
  { dx: -104, dy: 126 },
  { dx: 108, dy: 132 },
];

/**
 * Peak-moment burst (#431): white flash → rarity-colored rays + expanding ring
 * + particles. `strong` (희귀 이상) lengthens the rays and doubles particles;
 * 일반 keeps it short so the rarity difference is felt.
 */
export function BurstOverlay({
  color,
  strong,
  profile,
  reducedMotion = false,
}: {
  color: string;
  strong: boolean;
  profile?: RevealMotionProfile;
  reducedMotion?: boolean;
}) {
  const t = useTokens();
  const p = useAnimatedValue(0);
  // 출석 트로피도 이 컴포넌트를 재사용한다. 기존 strong API는 유지하고,
  // 가챠만 더 세밀한 프로필을 주입한다.
  const motion = profile ?? getRevealMotionProfile(strong ? '희귀' : '일반', reducedMotion);

  useEffect(() => {
    p.setValue(0);
    Animated.timing(p, {
      toValue: 1,
      duration: motion.burstMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [motion, p]);

  const flashStyle = {
    opacity: p.interpolate({
      inputRange: [0, 0.12, 0.38, 1],
      outputRange: [motion.glowOpacity * 0.34, motion.glowOpacity * 0.18, 0, 0],
    }),
  };
  const rayOpacity = p.interpolate({
    inputRange: [0, 0.2, 0.75, 1],
    outputRange: [0, 0.95, 0.35, 0],
  });
  const rayScale = p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.1, 1, 1.15] });
  const particles = BURST_PARTICLES.slice(0, motion.particleCount);
  const particleColors = [color, t.warning, t.primary];
  const rays = Array.from({ length: motion.rayCount }, (_, index) =>
    Math.round((180 / Math.max(1, motion.rayCount)) * index),
  );

  return (
    <View style={styles.burstWrap} pointerEvents="none" testID="gacha-burst">
      <Animated.View style={[styles.flash, flashStyle, { backgroundColor: color }]} />
      {rays.map((deg) => (
        <Animated.View
          key={deg}
          style={[
            styles.ray,
            {
              height: 130 + motion.rayCount * 18,
              backgroundColor: color,
              opacity: rayOpacity,
            },
            { transform: [{ rotate: `${deg}deg` }, { scaleY: rayScale }] },
          ]}
        />
      ))}
      {Array.from({ length: motion.ringCount }, (_, index) => (
        <Animated.View
          key={index}
          testID={`gacha-burst-ring-${index}`}
          style={[
            styles.burstRing,
            {
              borderColor: color,
              opacity: p.interpolate({
                inputRange: [0, 0.15 + index * 0.05, 0.82, 1],
                outputRange: [0, 0.82 - index * 0.12, 0.12, 0],
              }),
              transform: [
                {
                  scale: p.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35 + index * 0.08, 1.65 + index * 0.35],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      {particles.map((pt, i) => (
        <Animated.View
          key={`${pt.dx}-${pt.dy}`}
          style={[
            styles.particle,
            {
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
          ]}>
          <Pictogram
            name={i % 3 === 0 ? 'leaf' : 'sparkle'}
            size={i % 2 === 0 ? 14 : 11}
            color={particleColors[i % particleColors.length]}
          />
        </Animated.View>
      ))}
    </View>
  );
}

const HERO_ORNAMENTS = [
  { left: 18, top: 78 },
  { right: 14, top: 58 },
  { left: 42, top: 28 },
  { right: 38, top: 112 },
  { left: 8, top: 146 },
  { right: 8, top: 158 },
  { left: 76, top: 8 },
  { right: 72, top: 8 },
  { left: 28, top: 188 },
  { right: 26, top: 196 },
] as const;

/**
 * 단챠 공용 히어로 리빌. `assetKey`는 가운데 아트 슬롯에만 들어가며 모션은
 * 전부 rarity 프로필이 결정한다. 새 가구가 추가되어도 이 컴포넌트는 바뀌지 않는다.
 */
export function RevealCard({
  entry,
  machine,
  large,
  reducedMotion = false,
}: {
  entry: RevealPlanItem;
  machine?: GachaMachine;
  large?: boolean;
  reducedMotion?: boolean;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const p = useAnimatedValue(reducedMotion ? 1 : 0);
  const fade = useAnimatedValue(reducedMotion ? 1 : 0);
  const glow = useAnimatedValue(reducedMotion ? 0.45 : 0.25);
  const profile = entry.profile;
  const color = rarityColor(entry.result.rarity);

  useEffect(() => {
    if (reducedMotion) {
      p.setValue(1);
      fade.setValue(1);
      glow.setValue(0.45);
      return;
    }
    p.setValue(0);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(p, {
        toValue: 1,
        duration: profile.revealMs,
        delay: entry.index * 80,
        easing: Easing.out(Easing.back(profile.heroScale > 1.1 ? 1.8 : 1.25)),
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: Math.min(220, profile.revealMs),
        delay: entry.index * 80,
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]).start();
    if (profile.tier === 'rare' || profile.tier === 'legendary') {
      const halo = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 520, useNativeDriver: NATIVE_DRIVER }),
          Animated.timing(glow, { toValue: 0.28, duration: 520, useNativeDriver: NATIVE_DRIVER }),
        ]),
      );
      halo.start();
      return () => halo.stop();
    }
  }, [entry.index, fade, glow, p, profile, reducedMotion]);

  const landingStyle = {
    opacity: fade,
    transform: [
      {
        translateY: p.interpolate({
          inputRange: [0, 1],
          outputRange: [-profile.heroLift, 0],
        }),
      },
      { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
    ],
  };
  const revealStyle = { opacity: fade };
  const haloStyle = {
    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.18, profile.glowOpacity] }),
    transform: [
      { scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, profile.heroScale] }) },
    ],
  };
  const heroOrnamentCount = Math.min(HERO_ORNAMENTS.length, Math.ceil(profile.particleCount / 2));

  if (large) {
    return (
      <Animated.View style={[styles.heroReveal, revealStyle]} testID={`gacha-hero-${profile.tier}`}>
        <View style={styles.heroStage}>
          {Array.from({ length: profile.ringCount }, (_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.heroHalo,
                haloStyle,
                {
                  borderColor: color,
                  width: 184 + index * 32,
                  height: 184 + index * 32,
                  left: (300 - (184 + index * 32)) / 2,
                  borderRadius: Radius.pill,
                },
              ]}
            />
          ))}
          {HERO_ORNAMENTS.slice(0, heroOrnamentCount).map((position, index) => (
            <Animated.View
              key={index}
              style={[styles.heroOrnament, position, haloStyle]}
              testID={`gacha-hero-ornament-${index}`}>
              <Pictogram
                name={index % 3 === 0 ? 'leaf' : 'sparkle'}
                size={index % 2 === 0 ? 18 : 14}
                color={index % 2 === 0 ? color : t.warning}
              />
            </Animated.View>
          ))}
          <Animated.View style={[styles.heroReward, landingStyle]}>
            <RewardArtwork entry={entry} size={profile.tier === 'legendary' ? 232 : 204} />
          </Animated.View>
          {machine && profile.tier !== 'legendary' ? (
            <View style={[styles.heroGift, { backgroundColor: machine.accent }]}>
              <GiftBoxArt machine={machine} size={112} testIDPrefix="reveal-gift-box" />
            </View>
          ) : null}
        </View>
        {entry.badgeLabel ? (
          <Text style={[styles.heroBadge, emph('bold'), { backgroundColor: color }]}>
            {entry.badgeLabel}
          </Text>
        ) : null}
        <Text style={[Typography.h3, styles.center, { color: StaticWhite }]} numberOfLines={2}>
          {entry.displayName}
        </Text>
        {entry.conversionLabel ? (
          <Text style={[styles.convertNote, emph('semibold'), { color: StaticWhite }]}>
            {entry.conversionLabel}
          </Text>
        ) : null}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.revealCard, landingStyle, { backgroundColor: t.surface, borderColor: color }]}>
      <RewardArtwork entry={entry} size={68} />
      {entry.badgeLabel ? (
        <Text style={[styles.revealBadge, emph('bold'), { backgroundColor: color }]}>
          {entry.badgeLabel}
        </Text>
      ) : null}
      <Text style={[Typography.supporting, styles.center, { color: t.text }]} numberOfLines={2}>
        {entry.displayName}
      </Text>
      {entry.conversionLabel ? (
        <Text style={[styles.convertNote, emph('normal'), { color: t.textMuted }]}>
          {entry.conversionLabel}
        </Text>
      ) : null}
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
    borderRadius: Radius.pill,
  },
  heroReveal: {
    width: 360,
    alignItems: 'center',
    gap: Spacing.two,
  },
  heroStage: {
    width: 340,
    height: 360,
    alignItems: 'center',
  },
  heroHalo: {
    position: 'absolute',
    top: 38,
    left: 58,
    borderWidth: 2,
  },
  heroOrnament: {
    position: 'absolute',
    zIndex: 4,
  },
  heroReward: {
    position: 'absolute',
    top: 6,
    zIndex: 3,
  },
  heroGift: {
    position: 'absolute',
    bottom: 14,
    zIndex: 2,
    width: 132,
    height: 132,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    color: StaticWhite,
    fontSize: 13,
    overflow: 'hidden',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
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
  burstRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: Radius.pill,
    borderWidth: 3,
  },
  particle: { position: 'absolute', width: 18, height: 18, alignItems: 'center' },

  // 다연차 flip reveal (#431)
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
});
