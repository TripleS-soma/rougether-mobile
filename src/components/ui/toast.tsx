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

import { GlassSurface } from '@/components/ui/glass-surface';
import { pressedStyle } from '@/components/ui/press-feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useAnimatedValue } from '@/hooks/use-stable-value';
import { NATIVE_DRIVER } from '@/utils/animation';
import { useT } from '@/i18n';

export type ToastType = 'info' | 'success' | 'error';

/**
 * 토스트에 붙는 동작 버튼 (#1676) — "실행 취소"처럼 지금 막 한 일을 되돌릴 때만. 동작이 있는
 * 토스트는 화면 다른 곳을 눌러도 닫히지 않는다(되돌릴 기회를 빼앗지 않게). 시간이 지나거나
 * 새 토스트가 오면 내려간다.
 */
export type ToastAction = { label: string; onPress: () => void };
/**
 * onDismiss — 동작 버튼을 누르지 않고 내려갈 때 한 번(시간 만료·탭으로 닫음·**다른 토스트가 덮음**).
 * "실행 취소" 토스트가 다른 토스트에 덮여 버튼이 사라지면, 되돌릴 수 없는 보류를 남기지 않고
 * 바로 확정하라는 신호다(#1677 리뷰).
 */
export type ToastOptions = { action?: ToastAction; durationMs?: number; onDismiss?: () => void };

type ToastContextValue = {
  /** Show a transient message; a new call replaces the current toast. */
  show: (message: string, type?: ToastType, options?: ToastOptions) => void;
};

// Default is a no-op so pure screens / the dev registry / tests can render
// without wrapping in a ToastProvider.
const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const VISIBLE_MS = 2500;
const FADE_MS = 180;

type ToastState = { message: string; type: ToastType; key: number; action?: ToastAction };

/**
 * Transient bottom toast for app-wide feedback (mainly API failures). Mount
 * once near the root; fire messages from anywhere via `useToast().show(...)`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  // 등장 진행도(0→1): 아래에서 밀려 올라오며 살짝 커진다. opacity를 쓰지 않는 건
  // 글래스 면(#1131)이 opacity 0에서 그려지지 않기 때문 — 토스트는 조건부 렌더라
  // 사라질 때는 다시 내려간 뒤 언마운트한다.
  const progress = useAnimatedValue(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 지금 떠 있는 토스트의 onDismiss — 동작 버튼을 누르면 비우고, 내려가거나 덮이면 한 번 부른다.
  const dismissRef = useRef<(() => void) | null>(null);
  const fireDismiss = useCallback(() => {
    const fn = dismissRef.current;
    dismissRef.current = null;
    fn?.();
  }, []);

  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    fireDismiss();
    Animated.timing(progress, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: NATIVE_DRIVER,
    }).start(() => setToast(null));
  }, [progress, fireDismiss]);

  const show = useCallback(
    (message: string, type: ToastType = 'info', options?: ToastOptions) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      // 앞 토스트가 덮인다 — 그 토스트의 동작 버튼도 사라지니 알린다.
      fireDismiss();
      dismissRef.current = options?.onDismiss ?? null;
      setToast({ message, type, key: Date.now(), action: options?.action });
      Animated.timing(progress, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: NATIVE_DRIVER,
      }).start();
      hideTimer.current = setTimeout(hide, options?.durationMs ?? VISIBLE_MS);
    },
    [progress, hide, fireDismiss],
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
      {/* 동작 버튼이 있는 토스트(실행 취소 등)는 다른 곳을 눌러도 남긴다 (#1676). */}
      <View style={styles.fill} onTouchStart={toast && !toast.action ? hide : undefined}>
        {children}
      </View>
      {toast ? (
        <ToastView
          toast={toast}
          progress={progress}
          onPress={hide}
          onAction={() => {
            // 동작을 골랐으니 '그냥 내려감' 알림은 보내지 않는다.
            dismissRef.current = null;
            toast.action?.onPress();
            hide();
          }}
        />
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  progress,
  onPress,
  onAction,
}: {
  toast: ToastState;
  progress: Animated.Value;
  onPress: () => void;
  onAction: () => void;
}) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const emph = useFontEmphasis();
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
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}>
      {/* 면은 GlassSurface (#1131) — iOS 26에선 토스트 색을 입힌 prominent 글래스,
          그 밖에선 종전과 같은 단색(fallback = tint). */}
      <GlassSurface
        interactive={false}
        tintColor={bg}
        fallbackColor={bg}
        style={styles.face}
        testID="toast-face">
        <View style={styles.row}>
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={tr('app.ui.closeToast')}
            style={({ pressed }) => [styles.messageWrap, pressed && pressedStyle('dim', t)]}>
            <Text style={[Typography.label, styles.text, { color: ink }]} numberOfLines={2}>
              {toast.message}
            </Text>
          </Pressable>
          {toast.action ? (
            <Pressable
              onPress={onAction}
              accessibilityRole="button"
              accessibilityLabel={toast.action.label}
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.action, pressed && pressedStyle('dim', t)]}>
              <Text style={[Typography.label, emph('semibold'), { color: ink }]}>
                {toast.action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </GlassSurface>
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
    alignItems: 'center',
  },
  // 그림자는 GlassSurface 폴백이 스스로 든다(lift) — 여기서 겹치지 않는다.
  face: {
    alignSelf: 'stretch',
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  text: {
    textAlign: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  messageWrap: { flexShrink: 1 },
  // 동작 버튼 (#1676) — 메시지 오른쪽, 밑줄 대신 굵기로 구분한다.
  action: { paddingHorizontal: Spacing.one },
});
