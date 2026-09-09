import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useToast } from '@/components/ui/toast';
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
  const { show: toast } = useToast();
  if (growthLevel == null || !Number.isSafeInteger(growthLevel) || growthLevel < 0) return null;
  const remaining =
    pointsToNextLevel != null && Number.isSafeInteger(pointsToNextLevel) && pointsToNextLevel > 0
      ? pointsToNextLevel
      : undefined;
  return (
    <Pressable
      accessible
      accessibilityRole={remaining == null ? 'text' : 'button'}
      accessibilityHint={remaining == null ? undefined : '다음 레벨까지 남은 포인트를 확인해요'}
      disabled={remaining == null}
      hitSlop={Spacing.two}
      onPress={
        remaining == null ? undefined : () => toast(`다음 레벨까지 ${remaining}포인트 남았어요`)
      }
      accessibilityLabel={`나의 방 레벨 ${growthLevel}${remaining == null ? '' : `, 다음 레벨까지 ${remaining}포인트`}${growthPoints == null ? '' : `, 누적 ${growthPoints}포인트`}`}>
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
