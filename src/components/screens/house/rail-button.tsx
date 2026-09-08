import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Radius, Spacing } from '@/constants/theme';
import type { useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 집 화면의 플로팅 레일 버튼 (#986) — house-screen.tsx에서 분리했다(리팩토링
 * 4묶음). 토큰·타이포는 화면이 이미 읽은 것을 그대로 받는다(종전 시그니처 유지).
 */
export type RailButtonProps = {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  accessibilityLabel: string;
  /** 점 색 — 받을 보상처럼 '지금 할 게 있다'를 남길 때만. */
  badge?: string;
  t: ReturnType<typeof useTokens>;
  Typography: ReturnType<typeof useTypography>;
};

/** 아트 위에 뜨는 액션 하나 — 흰 원 아이콘 + 그 아래 라벨. */
export function RailButton({
  icon,
  label,
  onPress,
  accessibilityLabel,
  badge,
  t,
  Typography,
}: RailButtonProps) {
  return (
    <ScalePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.railBtn}>
      {/* 원과 라벨 알약 둘 다 글래스 면 (#1050) — 라벨은 눌리는 면이 아니라 비상호작용. */}
      <GlassSurface style={styles.railCircle} fallbackColor={t.surface}>
        {icon}
        {badge ? <View style={[styles.railBadge, { backgroundColor: badge }]} /> : null}
      </GlassSurface>
      <GlassSurface style={styles.railLabelWrap} fallbackColor={t.surface} interactive={false}>
        <Text style={[Typography.supporting, { color: t.text }]} numberOfLines={1}>
          {label}
        </Text>
      </GlassSurface>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  railBtn: { alignItems: 'center', gap: Spacing.half },
  railCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railBadge: {
    position: 'absolute',
    top: Spacing.half,
    right: Spacing.half,
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  railLabelWrap: {
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.pill,
  },
});
