import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useToast } from '@/components/ui/toast';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type RoomGrowthProps = {
  growthLevel?: number;
  growthPoints?: number;
  pointsToNextLevel?: number;
};

export const RoomGrowthPill = memo(function RoomGrowthPill({
  growthLevel,
  growthPoints,
  pointsToNextLevel,
}: RoomGrowthProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const { show: toast } = useToast();
  const tr = useT();
  if (growthLevel == null || !Number.isSafeInteger(growthLevel) || growthLevel < 0) return null;
  const remaining =
    pointsToNextLevel != null && Number.isSafeInteger(pointsToNextLevel) && pointsToNextLevel > 0
      ? pointsToNextLevel
      : undefined;
  const points =
    growthPoints != null && Number.isSafeInteger(growthPoints) && growthPoints >= 0
      ? growthPoints
      : undefined;
  return (
    <Pressable
      accessible
      accessibilityRole={remaining == null ? 'text' : 'button'}
      accessibilityHint={remaining == null ? undefined : tr('roomShop.growth.hint')}
      disabled={remaining == null}
      hitSlop={Spacing.two}
      onPress={
        remaining == null ? undefined : () => toast(tr('roomShop.growth.toast', { n: remaining }))
      }
      accessibilityLabel={`${tr('roomShop.growth.a11y', { level: growthLevel })}${remaining == null ? '' : tr('roomShop.growth.a11yRemaining', { n: remaining })}${points == null ? '' : tr('roomShop.growth.a11yPoints', { n: points })}`}>
      <GlassSurface fallbackColor={t.surface} interactive={remaining != null} style={styles.glass}>
        <Text style={[Typography.label, emph('bold'), { color: t.text }]}>Lv. {growthLevel}</Text>
      </GlassSurface>
    </Pressable>
  );
});
const styles = StyleSheet.create({
  glass: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
