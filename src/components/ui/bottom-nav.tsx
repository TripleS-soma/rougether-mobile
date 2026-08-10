import { type FC, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type SvgProps } from 'react-native-svg';

import HomeActive from '@/assets/images/common/home-icon-active.svg';
import HomeInactive from '@/assets/images/common/home-icon.svg';
import HouseActive from '@/assets/images/common/house-icon-active.svg';
import HouseInactive from '@/assets/images/common/house-icon.svg';
import SettingsActive from '@/assets/images/common/settings-icon-active.svg';
import SettingsInactive from '@/assets/images/common/settings-icon.svg';
import { CoachTarget } from '@/components/ui/coach-mark';
import { Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useAnimatedValue } from '@/hooks/use-stable-value';

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

/** 활성 전환 시 스프링으로 한 번 통 튀는 탭 아이콘 (#446). */
function TabIcon({
  isActive,
  Icon: NavIcon,
  color,
}: {
  isActive: boolean;
  Icon: FC<SvgProps>;
  color: string;
}) {
  const bounce = useAnimatedValue(1);
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActive.current) {
      bounce.setValue(0.72);
      Animated.spring(bounce, {
        toValue: 1,
        friction: 3.4,
        tension: 240,
        useNativeDriver: true,
      }).start();
    }
    wasActive.current = isActive;
  }, [isActive, bounce]);
  return (
    <Animated.View style={{ transform: [{ scale: bounce }] }}>
      {/* SVG 스트로크는 currentColor (#529) — 테마 토큰이 color로 주입된다. */}
      <NavIcon width={24} height={24} color={color} />
    </Animated.View>
  );
}

/** App bottom navigation (나의 방 / 집 / 설정) with custom SVG icons. */
export function BottomNav({ active, onChange }: BottomNavProps) {
  const t = useTokens();
  const Typography = useTypography();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: t.surface,
          borderTopColor: t.border,
          // 시스템 내비게이션 바 높이(insets.bottom) + 여유(Spacing.three) — 여유가
          // 8dp(Spacing.two)면 내비 바가 높은 기기에서 겹쳐 보인다 (#456).
          paddingBottom: insets.bottom + Spacing.three,
        },
      ]}>
      {TABS.map(({ key, label, active: ActiveIcon, inactive: InactiveIcon }) => {
        const isActive = key === active;
        const inner = (
          <Pressable
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            style={styles.tab}>
            <TabIcon
              isActive={isActive}
              Icon={isActive ? ActiveIcon : InactiveIcon}
              color={isActive ? t.primary : t.icon}
            />
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
