import { useCallback, useContext, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { notificationIcon } from '@/constants/notifications';
import { Radius, ShadowColor, Spacing } from '@/constants/theme';
import { useAnimatedValue } from '@/hooks/use-stable-value';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/** 자동으로 접히기까지 (ms). 시스템 배너와 비슷한 체류 시간. */
export const BANNER_VISIBLE_MS = 5000;
const FADE_MS = 200;
/** 위로 이만큼 밀면 닫는다. */
const DISMISS_DY = -28;

export type NotificationBannerProps = {
  /** 서버 알림 종류 — 아이콘을 고른다. 모르는 값이면 종. */
  type?: string;
  title: string;
  body: string;
  /** 배너 탭 — 알림함 등 목적지로 보낸다. */
  onPress?: () => void;
  /** 자동 종료·스와이프·탭 후 정리. */
  onDismiss?: () => void;
  /** 자동 닫힘까지의 시간 — 0이면 자동으로 안 닫힌다(갤러리·테스트용). */
  visibleMs?: number;
};

/**
 * 앱이 켜져 있을 때 뜨는 인앱 푸시 배너 (#902).
 *
 * 포그라운드에서는 **앱이 전담해 그린다** — `push-events.ts`가
 * `shouldShowBanner: false`로 시스템 배너를 끄기 때문이다. 둘 다 켜면 같은
 * 알림이 두 번 뜬다. 트레이(`shouldShowList`)는 그대로 두므로 알림함에는 남는다.
 *
 * 자리는 화면 상단 — 시스템 알림과 같은 위치라 학습된 자리다. 미션
 * 배너(#571)와 같은 상단 슬롯을 쓰는데, 이쪽이 zIndex가 높아 잠깐 덮는다.
 * 5초 뒤 사라지므로 가리는 시간이 짧고, 겹쳐 그리면 둘 다 못 읽는다.
 */
export function NotificationBanner({
  type,
  title,
  body,
  onPress,
  onDismiss,
  visibleMs = BANNER_VISIBLE_MS,
}: NotificationBannerProps) {
  const t = useTokens();
  const Typography = useTypography();
  const insets = useContext(SafeAreaInsetsContext);
  const anim = useAnimatedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    Animated.timing(anim, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() =>
      onDismiss?.(),
    );
  }, [anim, onDismiss]);

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
    if (visibleMs > 0) timer.current = setTimeout(close, visibleMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [anim, close, visibleMs]);

  const handlePress = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    onPress?.();
    onDismiss?.();
  }, [onPress, onDismiss]);

  // 위로 밀어 닫기 — 시스템 배너와 같은 관용구. 가로 우세 제스처는 양보해
  // 셸 탭 페이저(#582)를 막지 않는다 (당김 새로고침과 같은 처방).
  const swipeUp = Gesture.Pan()
    .withTestId('notification-banner-pan')
    .activeOffsetY([-10, 10])
    .failOffsetX([-16, 16])
    .onEnd((e) => {
      'worklet';
      if (e.translationY < DISMISS_DY) close();
    })
    .runOnJS(true);

  return (
    <GestureDetector gesture={swipeUp}>
      <Animated.View
        testID="notification-banner"
        accessibilityRole="alert"
        style={[
          styles.wrap,
          {
            top: (insets?.top ?? 0) + Spacing.two,
            opacity: anim,
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
            ],
          },
        ]}>
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${body}`}
          style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: t.surfaceMuted }]}>
            <Icon name={notificationIcon(type)} size={18} color={t.text} />
          </View>
          <View style={styles.texts}>
            <Text style={[Typography.label, { color: t.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]} numberOfLines={2}>
              {body}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    // 미션 배너(zIndex 50)보다 위 — 잠깐 덮었다 사라진다.
    zIndex: 60,
    elevation: 60,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    shadowColor: ShadowColor,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: Spacing.half,
  },
});
