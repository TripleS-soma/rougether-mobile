import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

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
  if (growthLevel == null || !Number.isSafeInteger(growthLevel) || growthLevel < 0) return null;
  const remaining =
    pointsToNextLevel != null && Number.isSafeInteger(pointsToNextLevel) && pointsToNextLevel > 0
      ? pointsToNextLevel
      : undefined;
  return (
    <View
      accessible
      accessibilityLabel={`나의 방 레벨 ${growthLevel}${remaining == null ? '' : `, 다음 레벨까지 ${remaining}포인트`}${growthPoints == null ? '' : `, 누적 ${growthPoints}포인트`}`}>
      <GlassSurface fallbackColor={t.surface} interactive={false} style={styles.glass}>
        <View style={styles.row}>
          <Icon name="sparkles" size={16} color={t.primaryText} />
          <Text style={[Typography.label, emph('bold'), { color: t.text }]}>Lv. {growthLevel}</Text>
          {remaining != null ? (
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              다음까지 {remaining}P
            </Text>
          ) : null}
        </View>
      </GlassSurface>
    </View>
  );
});
const styles = StyleSheet.create({
  glass: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
