import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export type NavTab = 'myRoom' | 'house' | 'settings';

const TABS: { key: NavTab; label: string; icon: IconName }[] = [
  { key: 'myRoom', label: '나의 방', icon: 'myRoom' },
  { key: 'house', label: '집', icon: 'house' },
  { key: 'settings', label: '설정', icon: 'settings' },
];

export type BottomNavProps = {
  active: NavTab;
  onChange: (tab: NavTab) => void;
};

/** App bottom navigation (나의 방 / 집 / 설정). */
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
      {TABS.map(({ key, label, icon }) => {
        const isActive = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            style={styles.tab}>
            <Icon name={icon} size={24} color={isActive ? t.primary : t.textMuted} />
            <Text style={[Typography.supporting, { color: isActive ? t.primary : t.textMuted }]}>
              {label}
            </Text>
          </Pressable>
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
