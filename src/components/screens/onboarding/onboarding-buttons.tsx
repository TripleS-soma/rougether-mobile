import { Pressable, StyleSheet, Text } from 'react-native';

import { useToast } from '@/components/ui/toast';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 온보딩·소개 공용 CTA (#1282) — 소개 슬라이드가 로그인 전 화면으로 떨어져
 * 나가면서 두 화면이 같은 버튼을 쓰도록 옮겼다.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  blockedMessage,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** When set, a disabled tap stays live and explains itself with this toast. */
  blockedMessage?: string;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const { show: toast } = useToast();
  return (
    <Pressable
      onPress={disabled && blockedMessage ? () => toast(blockedMessage, 'error') : onPress}
      disabled={disabled && !blockedMessage}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.primaryBtn,
        { backgroundColor: disabled ? t.disabledBg : t.primary },
        pressed && !disabled && { backgroundColor: t.primaryActive },
      ]}>
      <Text style={[Typography.label, { color: disabled ? t.textMuted : t.onPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.textBtn}>
      <Text style={[Typography.supporting, { color: t.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  textBtn: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
