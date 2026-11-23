import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NAV_TABS, type NavTab, TabIcon } from '@/components/ui/bottom-nav';
import { NAV_ICON_LABEL_GAP } from '@/components/ui/bottom-nav-geometry';
import { CoachTarget } from '@/components/ui/coach-mark';
import { pressedStyle } from '@/components/ui/press-feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 세로 탭 줄의 폭 — 셸이 이만큼을 왼쪽에 떼고 탭 화면을 그린다. */
export const NAV_RAIL_WIDTH = 72;
const MIN_TAB_TOUCH_SIZE = 56;

export type NavRailProps = {
  active: NavTab;
  onChange: (tab: NavTab) => void;
  /** 탭 아이콘 위 빨간 점 — 아래 탭 바와 같은 뜻. 참조 고정 권장. */
  badges?: Partial<Record<NavTab, boolean>>;
};

/**
 * 왼쪽 세로 탭 줄 — 넓은 창(펼친 폴더블·태블릿·데스크톱 웹)에서 아래 탭 바를 대신한다.
 *
 * 아래 탭 바는 화면 위에 뜨는 오버레이라 넓고 낮은 화면에서 세로를 100pt쯤 가린다. 세로 줄은
 * 레이아웃에 자리를 차지하는 칸이라 탭 화면이 높이를 다 쓴다. 탭 목록·아이콘·코치마크 대상
 * (`nav-<탭>`)은 아래 탭 바와 같은 것을 쓴다. 문지르기 제스처는 없다(탭 간격이 넓어 누르면 된다).
 */
function NavRailBase({ active, onChange, badges }: NavRailProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="nav-rail"
      style={[
        styles.rail,
        { backgroundColor: t.surface, borderRightColor: t.border, paddingBottom: insets.bottom },
      ]}>
      {NAV_TABS.map(({ key, labelKey, accessibilityLabelKey, active: On, inactive: Off }) => {
        const label = tr(labelKey);
        const isActive = key === active;
        return (
          <CoachTarget key={key} id={key === 'myPage' ? 'nav-my-page' : `nav-${key}`}>
            <Pressable
              onPress={() => onChange(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={accessibilityLabelKey ? tr(accessibilityLabelKey) : label}
              accessibilityHint={badges?.[key] ? tr('nav.badgeAbsent') : undefined}
              testID={`nav-rail-tab-${key}`}
              style={({ pressed }) => [
                styles.tab,
                isActive && { backgroundColor: t.primarySoft },
                pressed && pressedStyle('dim', t),
              ]}>
              <TabIcon
                isActive={isActive}
                Icon={isActive ? On : Off}
                color={isActive ? t.primary : t.icon}
                badge={badges?.[key]}
                badgeColor={t.danger}
              />
              <Text
                style={[Typography.supporting, { color: isActive ? t.primaryText : t.textMuted }]}
                numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          </CoachTarget>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: NAV_RAIL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    width: NAV_RAIL_WIDTH - Spacing.two * 2,
    minHeight: MIN_TAB_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: NAV_ICON_LABEL_GAP,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
  },
});

/** 셸이 렌더될 때마다 같이 그려지지 않게 — 셸은 콜백 참조를 고정해 넘긴다. */
export const NavRail = memo(NavRailBase);
