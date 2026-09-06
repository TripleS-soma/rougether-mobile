import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type ListRowProps = {
  icon: IconName;
  label: string;
  onPress?: () => void;
  /** 카드의 마지막 행 — 아래 구분선을 긋지 않는다. */
  last?: boolean;
};

/**
 * 설정·마이페이지 공용 목록 행 (#1088 리뷰) — 아이콘 원 + 라벨 + 화살표, 눌림
 * 틴트, 하단 구분선. 두 화면이 같은 마크업을 각자 들고 있던 것을 한 곳으로.
 * 글래스 카드 안에 세로로 쌓아 쓴다(카드·섹션 제목은 호출부 몫).
 */
export function ListRow({ icon, label, onPress, last = false }: ListRowProps) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: t.primarySoft },
        !last && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}>
      <View style={styles.left}>
        <View style={[styles.iconCircle, { backgroundColor: t.primarySoft }]}>
          <Icon name={icon} size={20} color={t.primaryText} />
        </View>
        <Text style={[Typography.body, { color: t.text }]}>{label}</Text>
      </View>
      <Icon name="forward" size={16} color={t.textDisabled} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flexShrink: 1,
  },
  iconCircle: {
    width: Spacing.four + Spacing.three,
    height: Spacing.four + Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
