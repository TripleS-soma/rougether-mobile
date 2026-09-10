import { Pressable, StyleSheet, Text } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 공개/비공개 선택 카드 — 집 생성과 집 정보 수정(#1266)이 같이 쓴다.
 * 라디오 의미(accessibilityRole="radio"); 선택된 쪽만 accent 테두리.
 */
export function PrivacyCard({
  selected,
  accent,
  title,
  subtitle,
  onPress,
  t,
}: {
  selected: boolean;
  accent: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  t: ReturnType<typeof useTokens>;
}) {
  const Typography = useTypography();
  const emph = useFontEmphasis();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.privacyCard,
        { backgroundColor: t.surfaceMuted, borderColor: selected ? accent : 'transparent' },
      ]}>
      <Text style={[Typography.label, { color: t.text }]}>{title}</Text>
      <Text style={[styles.privacySub, emph('normal'), { color: t.textMuted }]}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  privacyCard: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 2,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  privacySub: { fontSize: 13 },
});
