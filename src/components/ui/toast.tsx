import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Radius, ShadowColor, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useAnimatedValue } from '@/hooks/use-stable-value';

export type ToastType = 'info' | 'success' | 'error';

type ToastContextValue = {
  /** Show a transient message; a new call replaces the current toast. */
  show: (message: string, type?: ToastType) => void;
};

// Default is a no-op so pure screens / the dev registry / tests can render
// without wrapping in a ToastProvider.
const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const VISIBLE_MS = 2500;
const FADE_MS = 180;

type ToastState = { message: string; type: ToastType; key: number };

/**
 * Transient bottom toast for app-wide feedback (mainly API failures). Mount
 * once near the root; fire messages from anywhere via `useToast().show(...)`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useAnimatedValue(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() =>
      setToast(null),
    );
  }, [opacity]);

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ message, type, key: Date.now() });
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(hide, VISIBLE_MS);
    },
    [opacity, hide],
  );

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {/* Any touch anywhere in the app dismisses the toast early (touch events
          bubble here without stealing the child interaction). */}
      <View style={styles.fill} onTouchStart={toast ? hide : undefined}>
        {children}
      </View>
      {toast ? <ToastView toast={toast} opacity={opacity} onPress={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  opacity,
  onPress,
}: {
  toast: ToastState;
  opacity: Animated.Value;
  onPress: () => void;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const insets = useContext(SafeAreaInsetsContext);
  // 기본(무타입) 토스트는 브랜드 primary — 테마를 바꾸면 토스트도 따라
  // 바뀐다(테마 연결 요청). error/success는 시맨틱 유지.
  const bg = toast.type === 'error' ? t.danger : toast.type === 'success' ? t.success : t.primary;
  const ink = t.onPrimary;

  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        styles.toast,
        {
          // Above the bottom nav (≈64px) and the home indicator on any device.
          bottom: (insets?.bottom ?? 0) + 80,
          backgroundColor: bg,
          opacity,
          transform: [
            { translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="알림 닫기">
        <Text style={[Typography.label, styles.text, { color: ink }]} numberOfLines={2}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    elevation: 4,
    shadowColor: ShadowColor,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: {
    textAlign: 'center',
  },
});
