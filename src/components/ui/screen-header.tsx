import { type ReactNode, useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { HEADER_ROW_HEIGHT, HEADER_TOP_GAP } from '@/components/ui/screen-header-geometry';
import { Radius, Spacing } from '@/constants/theme';
import { useLiquidGlass } from '@/hooks/use-liquid-glass';
import { useHeaderInsetStyle } from '@/hooks/use-screen-style';
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
 * 두 가지 모습 (#1069):
 * - **리퀴드 글래스** (iOS 26 + Xcode 26 빌드, 투명도 줄이기 꺼짐) — 뒤로가기
 *   원과 제목 알약이 상단에 **떠 있는 오버레이**. 레이아웃 높이가 없으므로 밑을
 *   지나는 스크롤 화면이 `useHeaderContentInset()`만큼 상단 패딩을 가져야 한다.
 * - **불투명 바** (그 외 전부) — 종전 그대로. 상태바 인셋을 헤더가 직접 갖는다
 *   (#493) — surface 배경이 상태바 밑까지 이어져 시스템 바 영역과 헤더가 한 색으로
 *   읽힌다. 사용하는 화면의 루트는 `useScreenStyle([])`(top 패딩 없음)이어야
 *   이중 패딩이 안 생긴다.
 */
export function ScreenHeader({ title, onBack, backLabel = '뒤로 가기', right }: ScreenHeaderProps) {
  const t = useTokens();
  const Typography = useTypography();
  const headerInset = useHeaderInsetStyle();
  const glass = useLiquidGlass();
  const insets = useContext(SafeAreaInsetsContext);
  if (glass) {
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
            <Text style={[Typography.h3, { color: t.text }]} numberOfLines={1}>
              {title}
            </Text>
          </GlassSurface>
        </View>
        {right ?? null}
      </View>
    );
  }
  return (
    <View
      testID="screen-header"
      style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
      <View style={styles.left}>
        {onBack ? <IconButton name="back" accessibilityLabel={backLabel} onPress={onBack} /> : null}
        <Text style={[Typography.h2, { color: t.text }]}>{title}</Text>
      </View>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
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
    flex: 1,
  },
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
