import { GlassView } from 'expo-glass-effect';
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
import {
  NAV_ICON_LABEL_GAP,
  NAV_ICON_SIZE,
  NAV_PILL_PAD_H,
  NAV_PILL_PAD_V,
  navPillBottomOffset,
} from '@/components/ui/bottom-nav-geometry';
import { CoachTarget } from '@/components/ui/coach-mark';
import { Radius, Spacing } from '@/constants/theme';
import { useLiquidGlass } from '@/hooks/use-liquid-glass';
import { useResolvedScheme, useTokens, useTypography } from '@/hooks/use-tokens';
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
      <NavIcon width={NAV_ICON_SIZE} height={NAV_ICON_SIZE} color={color} />
    </Animated.View>
  );
}

/**
 * App bottom navigation (나의 방 / 집 / 설정) with custom SVG icons.
 *
 * 두 가지 모습 (#1049):
 * - **리퀴드 글래스 알약** (iOS 26 + Xcode 26 빌드, 투명도 줄이기 꺼짐) —
 *   화면 바닥에 떠 있는 오버레이. 레이아웃 높이가 없으므로 밑을 지나는
 *   스크롤 화면이 `useBottomNavInset()`만큼 하단 패딩을 가져야 한다.
 * - **불투명 바** (그 외 전부) — 종전 그대로 콘텐츠의 flex 형제.
 */
export function BottomNav({ active, onChange }: BottomNavProps) {
  const t = useTokens();
  const Typography = useTypography();
  const insets = useSafeAreaInsets();
  const glass = useLiquidGlass();
  const scheme = useResolvedScheme();
  const tabs = TABS.map(({ key, label, active: ActiveIcon, inactive: InactiveIcon }) => {
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
        <Text style={[Typography.supporting, { color: isActive ? t.primaryText : t.textMuted }]}>
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
  });

  if (glass) {
    return (
      // box-none: 알약 바깥(좌우 빈 띠)의 터치는 밑 콘텐츠로 흘린다.
      <View
        pointerEvents="box-none"
        testID="bottom-nav-glass"
        style={[styles.floatWrap, { bottom: navPillBottomOffset(insets.bottom) }]}>
        {/* colorScheme: 앱의 다크 모드 강제(#755)가 시스템과 다를 수 있어 명시.
            tint 없음 — 시스템 탭바처럼 밑 콘텐츠 색을 그대로 비춘다. */}
        <GlassView glassEffectStyle="regular" colorScheme={scheme} style={styles.pill}>
          {tabs}
        </GlassView>
      </View>
    );
  }

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
      {tabs}
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
    gap: NAV_ICON_LABEL_GAP,
    paddingHorizontal: Spacing.three,
  },
  // 알약 오버레이 — 폭은 탭 3개에 맞춰 줄어들고(alignItems), 좌우는 빈 띠.
  floatWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    paddingVertical: NAV_PILL_PAD_V,
    paddingHorizontal: NAV_PILL_PAD_H,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
});
