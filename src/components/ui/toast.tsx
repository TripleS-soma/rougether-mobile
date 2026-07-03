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
import { Animated, StyleSheet, Text } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

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
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ message, type, key: Date.now() });
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(
          () => setToast(null),
        );
      }, VISIBLE_MS);
    },
    [opacity],
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
      {children}
      {toast ? <ToastView toast={toast} opacity={opacity} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, opacity }: { toast: ToastState; opacity: Animated.Value }) {
  const t = useTokens();
  const bg = toast.type === 'error' ? t.danger : toast.type === 'success' ? t.success : t.text;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="alert"
      style={[
        styles.toast,
        {
          backgroundColor: bg,
          opacity,
          transform: [
            { translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}>
      <Text style={[Typography.label, styles.text, { color: t.onPrimary }]} numberOfLines={2}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    // Sits above the bottom nav (nav ≈ 64px + safe area).
    bottom: 96,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: {
    textAlign: 'center',
  },
});
