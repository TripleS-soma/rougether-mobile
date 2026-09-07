import { type FC, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type SvgProps } from 'react-native-svg';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated from 'react-native-reanimated';

import CalendarActive from '@/assets/images/common/calendar-icon-active.svg';
import CalendarInactive from '@/assets/images/common/calendar-icon.svg';
import HomeActive from '@/assets/images/common/home-icon-active.svg';
import HomeInactive from '@/assets/images/common/home-icon.svg';
import HouseActive from '@/assets/images/common/house-icon-active.svg';
import HouseInactive from '@/assets/images/common/house-icon.svg';
import ProfileActive from '@/assets/images/common/profile-icon-active.svg';
import ProfileInactive from '@/assets/images/common/profile-icon.svg';
import {
  NAV_ICON_LABEL_GAP,
  NAV_ICON_SIZE,
  NAV_PILL_PAD_H,
  NAV_PILL_GAP,
  NAV_PILL_PAD_V,
  NAV_TAB_PAD_H,
  navPillBottomOffset,
} from '@/components/ui/bottom-nav-geometry';
import { CoachTarget } from '@/components/ui/coach-mark';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useBottomNavScrub } from '@/components/ui/use-bottom-nav-scrub';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useAnimatedValue } from '@/hooks/use-stable-value';

export type NavTab = 'myRoom' | 'calendar' | 'house' | 'myPage';

const TABS: { key: NavTab; label: string; active: FC<SvgProps>; inactive: FC<SvgProps> }[] = [
  { key: 'myRoom', label: '나의 방', active: HomeActive, inactive: HomeInactive },
  // 달력 (#1138) — 나의 방 안의 방/달력 알약에서 하단 탭으로.
  { key: 'calendar', label: '달력', active: CalendarActive, inactive: CalendarInactive },
  { key: 'house', label: '집', active: HouseActive, inactive: HouseInactive },
  // 마이페이지 (#1088) — 설정 탭을 대체. 설정은 마이페이지 헤더의 톱니로 들어간다.
  { key: 'myPage', label: '마이페이지', active: ProfileActive, inactive: ProfileInactive },
];

export type BottomNavProps = {
  active: NavTab;
  onChange: (tab: NavTab) => void;
  /** 탭 아이콘 위 빨간 점 (#1089) — 마이페이지의 오늘 미출석. 참조 고정 권장. */
  badges?: Partial<Record<NavTab, boolean>>;
};

/** 활성 전환 시 스프링으로 한 번 통 튀는 탭 아이콘 (#446). */
function TabIcon({
  isActive,
  Icon: NavIcon,
  color,
  badge,
  badgeColor,
}: {
  isActive: boolean;
  Icon: FC<SvgProps>;
  color: string;
  badge?: boolean;
  badgeColor: string;
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
      {badge ? (
        <View testID="bottom-nav-badge" style={[styles.badge, { backgroundColor: badgeColor }]} />
      ) : null}
    </Animated.View>
  );
}

/**
 * App bottom navigation (나의 방 / 달력 / 집 / 마이페이지) with custom SVG icons.
 *
 * 화면 바닥에 떠 있는 알약 오버레이 (#1049 → #1074에서 전 플랫폼 공통). 레이아웃
 * 높이가 없으므로 밑을 지나는 스크롤 화면이 `useBottomNavInset()`만큼 하단
 * 패딩을 가져야 한다. 면의 재질(글래스/반투명/불투명)은 GlassSurface가 고른다.
 */
export function BottomNav({ active, onChange, badges }: BottomNavProps) {
  const t = useTokens();
  const Typography = useTypography();
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  // 탭을 같은 폭으로 (#1098) — 라벨 길이가 달라("집" vs "마이페이지") 탭 폭이
  // 제각각이면 가운데 탭이 알약 중앙에서 벗어난다. 라벨의 자연 폭을 재서 가장
  // 넓은 것에 맞춘다. 고정 상수가 아닌 이유: 선택 폰트(#382)·글꼴 배율마다 다르다.
  const [labelWidths, setLabelWidths] = useState<number[]>([]);
  // 4탭(#1138)부터는 좁은 기기에서 라벨 폭 합이 화면을 넘을 수 있다 — 알약이 화면
  // 안에 들도록 탭 폭 상한을 두고, 라벨은 그 안에서 줄인다(adjustsFontSizeToFit).
  const tabCap =
    (windowW - Spacing.four * 2 - NAV_PILL_PAD_H * 2 - NAV_PILL_GAP * (TABS.length - 1)) /
    TABS.length;
  const tabMinWidth =
    labelWidths.length === TABS.length
      ? Math.min(Math.max(...labelWidths) + NAV_TAB_PAD_H * 2, tabCap)
      : undefined;
  const recordLabel = (index: number, width: number) =>
    setLabelWidths((prev) => {
      if (prev[index] === width) return prev;
      const next = [...prev];
      next[index] = width;
      return next;
    });
  const { pan, indicatorStyle, recordTab, recordHeight } = useBottomNavScrub((index) => {
    const tab = TABS[index]?.key;
    if (tab && tab !== active) onChange(tab);
  }, TABS.length);
  const tabs = TABS.map(({ key, label, active: ActiveIcon, inactive: InactiveIcon }, index) => {
    const isActive = key === active;
    // RN Pressable (#1093): RNGH Pressable + `requireExternalGestureToFail(pan)` 조합은
    // Android에서 탭이 영영 발화하지 않았다(iOS만 동작). 일반 Pressable은 pan이
    // 활성화(8px 이동)되는 순간 터치 취소를 받아 탭과 끌기가 자연히 갈린다.
    const inner = (
      <Pressable
        onPress={() => onChange(key)}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={label}
        accessibilityHint={badges?.[key] ? '오늘 미출석' : undefined}
        style={[styles.tab, tabMinWidth ? { minWidth: tabMinWidth, maxWidth: tabCap } : null]}>
        <TabIcon
          isActive={isActive}
          Icon={isActive ? ActiveIcon : InactiveIcon}
          color={isActive ? t.primary : t.icon}
          badge={badges?.[key]}
          badgeColor={t.danger}
        />
        <Text
          style={[Typography.supporting, { color: isActive ? t.primaryText : t.textMuted }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          onLayout={(e) => recordLabel(index, e.nativeEvent.layout.width)}>
          {label}
        </Text>
      </Pressable>
    );
    // 마이페이지 탭은 코치마크 마지막 단계의 대상 (#351 → #1088).
    return (
      <View
        key={key}
        testID={`bottom-nav-tab-${key}`}
        onLayout={(e) => recordTab(index, e.nativeEvent.layout)}>
        {key === 'myPage' ? <CoachTarget id="nav-my-page">{inner}</CoachTarget> : inner}
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
    paddingHorizontal: NAV_TAB_PAD_H,
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
  // 아이콘 오른쪽 위 점 — 방 메뉴 버튼의 점(#1055)과 같은 크기.
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: Spacing.one,
    bottom: Spacing.one,
    borderRadius: Radius.pill,
  },
});
