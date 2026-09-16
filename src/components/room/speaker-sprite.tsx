import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import { SPEAKER_IMAGE } from '@/resources/speaker';
import { NATIVE_DRIVER } from '@/utils/animation';
import { useT } from '@/i18n';

export function SpeakerSprite({ playing = false }: { playing?: boolean }) {
  const tr = useT();
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (!playing || reduced) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 420,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [playing, reduced, pulse]);
  return (
    <Animated.View
      testID="speaker-sprite"
      accessibilityLabel={tr(
        playing ? 'roomShop.speaker.spriteOnA11y' : 'roomShop.speaker.spriteOffA11y',
      )}
      style={[
        styles.art,
        {
          transform: [
            { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] }) },
            { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1.5deg'] }) },
          ],
        },
      ]}>
      <Image source={SPEAKER_IMAGE} style={styles.art} contentFit="contain" />
    </Animated.View>
  );
}
const styles = StyleSheet.create({ art: { width: '100%', height: '100%' } });
