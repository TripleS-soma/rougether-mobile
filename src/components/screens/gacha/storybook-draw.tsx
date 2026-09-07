import { Image } from 'expo-image';
import { useEffect, useId, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import type { GachaMachine } from '@/api/adapters';
import { GiftBoxArt } from '@/components/screens/gacha/gift-box-art';
import { Pictogram } from '@/components/ui/pictograms';
import { GachaSceneColors as Scene, GachaStage, Spacing } from '@/constants/theme';
import { useAnimatedValue } from '@/hooks/use-stable-value';
import { GACHA_ART, GIFT_ATLAS, GIFT_OPEN_MS } from '@/resources/gacha-art';
import { hapticSelection } from '@/utils/haptics';

export type GiftStagePhase = 'charging' | 'ready' | 'opening';

export function StorybookBackdrop() {
  return (
    <View
      pointerEvents="none"
      aria-hidden
      style={StyleSheet.absoluteFill}
      testID="gacha-storybook-backdrop">
      <Image source={GACHA_ART.backdrop} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.veil]} />
    </View>
  );
}

/** Runtime atlas clipping preserves the generated PNG's real alpha channel. */
function GiftPart({
  part,
  size,
  onError,
}: {
  part: 'lid' | 'base';
  size: number;
  onError: () => void;
}) {
  const start = part === 'lid' ? 0 : GIFT_ATLAS.split;
  const height = part === 'lid' ? GIFT_ATLAS.split : 1 - GIFT_ATLAS.split;
  return (
    <View
      style={[styles.part, { top: size * start, width: size, height: size * height }]}
      testID={`gacha-painted-${part}`}>
      <Image
        source={GACHA_ART.parts}
        contentFit="fill"
        cachePolicy="memory"
        onError={onError}
        testID={`gacha-painted-${part}-image`}
        style={{ position: 'absolute', top: -size * start, width: size, height: size }}
      />
    </View>
  );
}

/** The same painted present on the backs of multi-draw reward cards. */
export function PaintedGiftIcon({ size }: { size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Pictogram name="gift" size={size * 0.6} color={Scene.gold} />;
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateY: size * GIFT_ATLAS.centerOffset }] },
        ]}>
        <GiftPart part="base" size={size} onError={() => setFailed(true)} />
        <View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateY: size * GIFT_ATLAS.closedLidOffset }] },
          ]}>
          <GiftPart part="lid" size={size} onError={() => setFailed(true)} />
        </View>
      </View>
    </View>
  );
}

/** A painted, independently animated lid/base, not a wobbling UI tile. */
export function GiftOpeningStage({
  phase,
  machine,
  onOpen,
  reducedMotion = false,
}: {
  phase: GiftStagePhase;
  machine?: GachaMachine;
  onOpen?: () => void;
  reducedMotion?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(GachaStage.storybook, width - Spacing.four * 2, height * 0.42);
  const pulse = useAnimatedValue(0);
  const opening = useAnimatedValue(0);
  const [artFailed, setArtFailed] = useState(false);
  const gradientId = useId().replace(/:/g, '');
  const ready = phase === 'ready';
  const isOpening = phase === 'opening';

  useEffect(() => {
    if (reducedMotion || isOpening) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: ready ? 420 : 650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: ready ? 420 : 650,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [pulse, ready, isOpening, reducedMotion]);

  useEffect(() => {
    if (!isOpening) return;
    if (reducedMotion) {
      opening.setValue(1);
      return;
    }
    const animation = Animated.timing(opening, {
      toValue: 1,
      duration: GIFT_OPEN_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start();
    const beat = setTimeout(hapticSelection, 220);
    return () => {
      animation.stop();
      clearTimeout(beat);
    };
  }, [opening, isOpening, reducedMotion]);

  const glowOpacity = isOpening
    ? opening.interpolate({ inputRange: [0, 0.12, 0.35, 0.8, 1], outputRange: [0, 0.3, 1, 0.8, 0] })
    : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, ready ? 0.55 : 0.28] });

  return (
    <Pressable
      onPress={onOpen}
      disabled={!ready}
      accessibilityRole="button"
      accessibilityLabel="선물상자 열기"
      accessibilityHint="이미 뽑은 선물을 열어요. 재화는 추가로 사용하지 않아요."
      accessibilityState={{ disabled: !ready }}
      testID="gacha-gift-stage"
      style={{ width: size, height: size }}>
      <Animated.View
        pointerEvents="none"
        aria-hidden
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: glowOpacity,
            transform: [
              {
                scale: isOpening
                  ? opening.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.6] })
                  : 1,
              },
            ],
          },
        ]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`${gradientId}-halo`}>
              <Stop offset="0" stopColor={Scene.glow} stopOpacity={1} />
              <Stop offset="1" stopColor={Scene.glow} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={`${gradientId}-beam`} x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={Scene.glow} stopOpacity={0.95} />
              <Stop offset="1" stopColor={Scene.glow} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Ellipse cx={50} cy={52} rx={48} ry={44} fill={`url(#${gradientId}-halo)`} />
          {isOpening ? (
            <Path d="M32 58 L8 0 L92 0 L68 58 Z" fill={`url(#${gradientId}-beam)`} />
          ) : null}
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        aria-hidden
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: isOpening
              ? opening.interpolate({ inputRange: [0, 0.84, 1], outputRange: [1, 1, 0] })
              : 1,
            transform: [
              { translateY: size * GIFT_ATLAS.centerOffset },
              {
                scale: isOpening
                  ? opening.interpolate({
                      inputRange: [0, 0.12, 0.3, 0.55, 1],
                      outputRange: [1, 0.92, 1.08, 1, 0.94],
                    })
                  : pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }),
              },
              {
                rotate: isOpening
                  ? '0deg'
                  : pulse.interpolate({
                      inputRange: [0, 0.25, 0.5, 0.75, 1],
                      outputRange: ['0deg', '-2deg', '0deg', '2deg', '0deg'],
                    }),
              },
            ],
          },
        ]}>
        {artFailed ? (
          <View style={styles.fallback} testID="gacha-art-fallback">
            {machine ? (
              <GiftBoxArt machine={machine} size={size * 0.6} />
            ) : (
              <Pictogram name="gift" size={size * 0.5} />
            )}
          </View>
        ) : (
          <>
            <GiftPart part="base" size={size} onError={() => setArtFailed(true)} />
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: isOpening
                    ? opening.interpolate({
                        inputRange: [0, 0.62, 0.9, 1],
                        outputRange: [1, 1, 0, 0],
                      })
                    : 1,
                  transform: [
                    {
                      translateY: isOpening
                        ? opening.interpolate({
                            inputRange: [0, 0.16, 0.45, 1],
                            outputRange: [
                              size * GIFT_ATLAS.closedLidOffset,
                              size * (GIFT_ATLAS.closedLidOffset + 0.02),
                              size * GIFT_ATLAS.openLidOffset,
                              -size * 0.18,
                            ],
                          })
                        : size * GIFT_ATLAS.closedLidOffset,
                    },
                    {
                      rotate: isOpening
                        ? opening.interpolate({
                            inputRange: [0, 0.16, 0.65, 1],
                            outputRange: ['0deg', '0deg', '-15deg', '-24deg'],
                          })
                        : '0deg',
                    },
                  ],
                },
              ]}>
              <GiftPart part="lid" size={size} onError={() => setArtFailed(true)} />
            </Animated.View>
          </>
        )}
      </Animated.View>
      {!reducedMotion &&
        Array.from({ length: 9 }, (_, i) => {
          const angle = (i / 9) * Math.PI * 2;
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              aria-hidden
              testID="gacha-stage-star"
              style={[
                styles.star,
                {
                  left: size / 2 - Spacing.two,
                  top: size / 2,
                  opacity: isOpening
                    ? opening.interpolate({
                        inputRange: [0, 0.2, 0.4, 0.85, 1],
                        outputRange: [0, 0, 1, 0.5, 0],
                      })
                    : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.75] }),
                  transform: [
                    {
                      translateX: isOpening
                        ? opening.interpolate({
                            inputRange: [0, 0.2, 1],
                            outputRange: [0, 0, Math.cos(angle) * size * 0.48],
                          })
                        : Math.cos(angle) * size * 0.4,
                    },
                    {
                      translateY: isOpening
                        ? opening.interpolate({
                            inputRange: [0, 0.2, 1],
                            outputRange: [0, 0, Math.sin(angle) * size * 0.45 - size * 0.12],
                          })
                        : Math.sin(angle) * size * 0.32,
                    },
                    {
                      scale: isOpening
                        ? opening.interpolate({
                            inputRange: [0, 0.3, 0.6, 1],
                            outputRange: [0, 0.3, 1.4, 0.4],
                          })
                        : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
                    },
                  ],
                },
              ]}>
              <Pictogram
                name="sparkle"
                size={i % 3 === 0 ? Spacing.four : Spacing.three}
                color={i % 2 ? Scene.gold : Scene.glow}
              />
            </Animated.View>
          );
        })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: Scene.veil },
  part: { position: 'absolute', overflow: 'hidden' },
  star: { position: 'absolute' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
