import { type FC, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type SvgProps } from 'react-native-svg';
import { GestureDetector, Pressable } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';

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
  NAV_PILL_GAP,
  NAV_PILL_PAD_V,
  navPillBottomOffset,
} from '@/components/ui/bottom-nav-geometry';
import { CoachTarget } from '@/components/ui/coach-mark';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useBottomNavScrub } from '@/components/ui/use-bottom-nav-scrub';
import { Radius, Spacing } from '@/constants/theme';
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
      <NavIcon width={NAV_ICON_SIZE} height={NAV_ICON_SIZE} color={color} />
    </Animated.View>
  );
}

/**
 * App bottom navigation (나의 방 / 집 / 설정) with custom SVG icons.
 *
 * 화면 바닥에 떠 있는 알약 오버레이 (#1049 → #1074에서 전 플랫폼 공통). 레이아웃
 * 높이가 없으므로 밑을 지나는 스크롤 화면이 `useBottomNavInset()`만큼 하단
 * 패딩을 가져야 한다. 면의 재질(글래스/반투명/불투명)은 GlassSurface가 고른다.
 */
export function BottomNav({ active, onChange }: BottomNavProps) {
  const t = useTokens();
  const Typography = useTypography();
  const insets = useSafeAreaInsets();
  const { pan, indicatorStyle, recordTab, recordHeight } = useBottomNavScrub((index) => {
    const tab = TABS[index]?.key;
    if (tab && tab !== active) onChange(tab);
  });
  const tabs = TABS.map(({ key, label, active: ActiveIcon, inactive: InactiveIcon }, index) => {
    const isActive = key === active;
    const inner = (
      <Pressable
        requireExternalGestureToFail={pan}
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
    return (
      <View
        key={key}
        testID={`bottom-nav-tab-${key}`}
        onLayout={(e) => recordTab(index, e.nativeEvent.layout)}>
        {key === 'settings' ? <CoachTarget id="nav-settings">{inner}</CoachTarget> : inner}
      </View>
    );
  });

  return (
    // box-none: 알약 바깥(좌우 빈 띠)의 터치는 밑 콘텐츠로 흘린다.
    <View
      pointerEvents="box-none"
      testID="bottom-nav-pill"
      style={[styles.floatWrap, { bottom: navPillBottomOffset(insets.bottom) }]}>
      {/* 면은 GlassSurface가 고른다 (#1074): iOS 26 글래스 / 반투명 surface / 불투명.
          tint 없음 — 시스템 탭바처럼 밑 콘텐츠 색을 그대로 비춘다. */}
      <GlassSurface interactive={false} fallbackColor={t.surface} style={styles.pill}>
        <GestureDetector gesture={pan}>
          <View
            collapsable={false}
            testID="bottom-nav-track"
            onLayout={(e) => recordHeight(e.nativeEvent.layout.height)}
            style={styles.track}>
            <Reanimated.View
              pointerEvents="none"
              testID="bottom-nav-scrub-indicator"
              style={[styles.indicator, { backgroundColor: t.primarySoft }, indicatorStyle]}
            />
            {tabs}
          </View>
        </GestureDetector>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  // 알약 안에서 탭 사이를 넉넉히 — 꽉 찬 바보다 여유 있게 읽히도록.
  tab: {
    alignItems: 'center',
    gap: NAV_ICON_LABEL_GAP,
    paddingHorizontal: Spacing.four,
  },
  // 알약 오버레이 — 폭은 탭 3개에 맞춰 줄어들고(alignItems), 좌우는 빈 띠.
  floatWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
    gap: NAV_PILL_GAP,
    paddingVertical: NAV_PILL_PAD_V,
    paddingHorizontal: NAV_PILL_PAD_H,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: Spacing.one,
    bottom: Spacing.one,
    borderRadius: Radius.pill,
  },
});
