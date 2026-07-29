import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type RetryStateProps = {
  /**
   * What failed to load ("…를 불러오지 못했어요."). Rendered as muted body
   * text, or as a headline when `detail` adds a supporting line.
   */
  message: string;
  /** Optional supporting line under the headline (네트워크 확인 안내 등). */
  detail?: string;
  /** Re-runs the failed load; the button is omitted when missing. */
  onRetry?: () => void;
  /** Button caption + accessibility label. */
  retryLabel?: string;
};

/**
 * Shared load-failure block (#557): error message + "다시 시도" pill, replacing
 * the copies that lived in each screen. Layout (centered column, Spacing.two
 * gap) matches the replaced blocks — screens keep their own outer padding
 * containers around it.
 */
export function RetryState({
  message,
  detail,
  onRetry,
  retryLabel = '다시 시도',
}: RetryStateProps) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.wrap}>
      <Text
        style={
          detail
            ? [Typography.h3, styles.center, { color: t.text }]
            : [Typography.body, styles.center, { color: t.textMuted }]
        }>
        {message}
      </Text>
      {detail ? (
        <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>{detail}</Text>
      ) : null}
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          style={[styles.retryBtn, { backgroundColor: t.primary }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  retryBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
});
