import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModalFrame } from '@/components/app/app-frame';
import { Overlay, Radius, Spacing } from '@/constants/theme';
import { useAnimatedValue, useLatestRef } from '@/hooks/use-stable-value';
import { useTokens } from '@/hooks/use-tokens';
import { NATIVE_DRIVER } from '@/utils/animation';

/** Dismissal completes before the event queue may mount the next native modal. */
export function ChristmasModalFrame({
  visible,
  label,
  onClose,
  onDismissed,
  children,
}: {
  visible: boolean;
  label: string;
  onClose: () => void;
  onDismissed: () => void;
  children: ReactNode;
}) {
  const t = useTokens();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rendered, setRendered] = useState(visible);
  const opacity = useAnimatedValue(visible ? 1 : 0);
  const renderedRef = useLatestRef(rendered);
  const onDismissedRef = useLatestRef(onDismissed);
  const pendingDismissal = useRef(false);
  const frameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const notifyDismissed = useCallback(() => {
    if (!pendingDismissal.current) return;
    pendingDismissal.current = false;
    onDismissedRef.current();
  }, [onDismissedRef]);

  useEffect(() => {
    if (visible) {
      pendingDismissal.current = false;
      setRendered(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: NATIVE_DRIVER,
      }).start();
      return;
    }
    if (!renderedRef.current) return;
    pendingDismissal.current = true;
    const animation = Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      setRendered(false);
      // UIKit reports actual dismissal through onDismiss. Android and web do not.
      if (Platform.OS !== 'ios') {
        frameRef.current = requestAnimationFrame(notifyDismissed);
      }
    });
    return () => animation.stop();
  }, [visible, opacity, notifyDismissed, renderedRef]);

  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      opacity.stopAnimation();
    },
    [opacity],
  );

  return (
    <Modal
      testID="christmas-modal"
      transparent
      visible={rendered}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={notifyDismissed}>
      <View style={[styles.scrim, { backgroundColor: Overlay.strong }]}>
        <ModalFrame>
          <View
            style={[
              styles.center,
              {
                paddingTop: insets.top + Spacing.three,
                paddingBottom: insets.bottom + Spacing.three,
              },
            ]}>
            <Animated.View
              accessibilityViewIsModal
              role="dialog"
              aria-modal
              accessibilityLabel={label}
              style={[
                styles.card,
                {
                  backgroundColor: t.screen,
                  maxHeight: height - insets.top - insets.bottom - Spacing.three * 2,
                  opacity,
                },
              ]}>
              {children}
            </Animated.View>
          </View>
        </ModalFrame>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  card: { width: '100%', maxWidth: 420, borderRadius: Radius.xl, overflow: 'hidden' },
});
