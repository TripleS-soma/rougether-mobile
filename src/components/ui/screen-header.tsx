import { type ReactNode, useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { HEADER_ROW_HEIGHT, HEADER_TOP_GAP } from '@/components/ui/screen-header-geometry';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type ScreenHeaderProps = {
  title: string;
  /** When provided, shows a back button on the left. */
  onBack?: () => void;
  backLabel?: string;
  /** Optional content pinned to the right (e.g. an action button or pill). */
  right?: ReactNode;
};

/**
 * Standard screen header: optional back button + title + optional right slot.
 *
 * 뒤로가기 원과 제목 알약이 상단에 **떠 있는 오버레이** (#1069 → #1074에서 전
 * 플랫폼 공통). 레이아웃 높이가 없으므로 밑을 지나는 스크롤 화면이
 * `useHeaderContentInset()`만큼 상단 패딩을 가져야 한다. 면의 재질(글래스/
 * 반투명/불투명)은 GlassSurface가 고른다. 사용하는 화면의 루트는
 * `useScreenStyle([])`(top 패딩 없음).
 */
export function ScreenHeader({ title, onBack, backLabel = '뒤로 가기', right }: ScreenHeaderProps) {
  const t = useTokens();
  const Typography = useTypography();
  const insets = useContext(SafeAreaInsetsContext);
  return (
    // box-none: 알약 사이 빈 띠의 터치는 밑 콘텐츠로 흘린다.
    <View
      testID="screen-header"
      pointerEvents="box-none"
      style={[styles.float, { top: (insets?.top ?? 0) + HEADER_TOP_GAP }]}>
      <View style={styles.floatLeft} pointerEvents="box-none">
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            style={styles.floatBtn}>
            <GlassSurface style={styles.floatFace} fallbackColor={t.surface}>
              <Icon name="back" size={20} color={t.text} />
            </GlassSurface>
          </Pressable>
        ) : null}
        <GlassSurface interactive={false} fallbackColor={t.surface} style={styles.titlePill}>
          {/* 긴 제목(친구 이름 등): 먼저 축소, 그래도 넘치면 중간 말줄임 — 의 방 같은
              접미가 살아남는다. */}
          <Text
            style={[Typography.h3, { color: t.text }]}
            numberOfLines={1}
            ellipsizeMode="middle"
            adjustsFontSizeToFit
            minimumFontScale={0.75}>
            {title}
          </Text>
        </GlassSurface>
      </View>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 떠 있는 헤더 (#1069) — 나의 방 크롬(#1055)과 같은 자리·높이.
  float: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    zIndex: 20,
  },
  floatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  floatBtn: {
    width: HEADER_ROW_HEIGHT,
    height: HEADER_ROW_HEIGHT,
  },
  floatFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePill: {
    flexShrink: 1,
    height: HEADER_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
});
