import { type FC, useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { type SvgProps } from 'react-native-svg';

import HomeActive from '@/assets/images/common/home-icon-active.svg';
import HomeInactive from '@/assets/images/common/home-icon.svg';
import HouseActive from '@/assets/images/common/house-icon-active.svg';
import HouseInactive from '@/assets/images/common/house-icon.svg';
import SettingsActive from '@/assets/images/common/settings-icon-active.svg';
import SettingsInactive from '@/assets/images/common/settings-icon.svg';
import { CoachTarget } from '@/components/ui/coach-mark';
import { Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export type NavTab = 'myRoom' | 'house' | 'settings';

const TABS: { key: NavTab; label: string; active: FC<SvgProps>; inactive: FC<SvgProps> }[] = [
  { key: 'myRoom', label: '나의 방', active: HomeActive, inactive: HomeInactive },
  { key: 'house', label: '집', active: HouseActive, inactive: HouseInactive },
  { key: 'settings', label: '설정', active: SettingsActive, inactive: SettingsInactive },
];

export type BottomNavProps = {
  active: NavTab;
  onChange: (tab: NavTab) => void;
};

/** App bottom navigation (나의 방 / 집 / 설정) with custom SVG icons. */
export function BottomNav({ active, onChange }: BottomNavProps) {
  const t = useTokens();
  const insets = useContext(SafeAreaInsetsContext);
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: t.surface,
          borderTopColor: t.border,
          paddingBottom: (insets?.bottom ?? 0) + Spacing.two,
        },
      ]}>
      {TABS.map(({ key, label, active: ActiveIcon, inactive: InactiveIcon }) => {
        const isActive = key === active;
        const NavIcon = isActive ? ActiveIcon : InactiveIcon;
        const inner = (
          <Pressable
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            style={styles.tab}>
            <NavIcon width={24} height={24} />
            <Text
              style={[Typography.supporting, { color: isActive ? t.primaryText : t.textMuted }]}>
              {label}
            </Text>
          </Pressable>
        );
        // 설정 탭은 코치마크 마지막 단계의 대상 (#351).
        return key === 'settings' ? (
          <CoachTarget key={key} id="nav-settings">
            {inner}
          </CoachTarget>
        ) : (
          <View key={key}>{inner}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: Spacing.two,
  },
  tab: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.three,
  },
});
