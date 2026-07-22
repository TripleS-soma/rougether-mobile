import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type PendingNoticeProps = {
  /** Honest one-liner about what is still server-side pending. */
  text: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Warning-tinted banner for features whose backend endpoint doesn't exist yet
 * ("서버 준비 중"). Keeps the honesty notices consistent across screens.
 */
export function PendingNotice({ text, style }: PendingNoticeProps) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View
      style={[styles.notice, { backgroundColor: t.warningSoft, borderColor: t.warning }, style]}>
      <Text style={[Typography.supporting, { color: t.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
