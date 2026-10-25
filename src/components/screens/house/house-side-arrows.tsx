import { Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type HouseSideArrowsProps = {
  /** 페이지가 둘 이상일 때만 그린다 (`totalPages > 1`). */
  showArrows: boolean;
  onPrev: () => void;
  onNext: () => void;
  /**
   * 버튼 윗변의 y. 없으면 정확히 세로 가운데다. 집 화면은 오른쪽 위에 플로팅 레일이 있어
   * 가운데가 레일과 겹치면 이 값으로 양쪽을 같이 내린다 — `sideArrowTop` 참고.
   */
  top?: number;
};

/** 버튼 지름 — 상단에 있던 화살표(#994)와 같은 크기. */
export const SIDE_ARROW_SIZE = 40;
const SIZE = SIDE_ARROW_SIZE;

/**
 * 화살표 윗변 위치 — 세로 가운데가 기본이고, 레일과 겹치면 레일 바로 아래로 내린다.
 *
 * 레일은 오른쪽 위에서 아래로 쌓인다(첫 버튼 = 안전영역 + 106, 버튼 64 + 간격 16). 실제 집엔
 * 채팅까지 4개라 iPhone 15(852)에서 469까지 내려오는데 가운데 화살표는 406~446이라 "집 관리"
 * 위에 얹힌다. 좌우를 같은 높이로 두려고 양쪽을 함께 내린다. 측정 전(0)엔 가운데다.
 */
export function sideArrowTop(screenHeight: number, railBottom: number): number | undefined {
  if (screenHeight <= 0) return undefined;
  const centered = screenHeight / 2 - SIZE / 2;
  if (railBottom <= 0) return centered;
  return Math.max(centered, railBottom + Spacing.three);
}

/**
 * 집 전환 화살표 — 화면 세로 가운데 양쪽에 뜬다 (#1575).
 *
 * 예전엔 상단 이름 뱃지 양옆(`‹ [집 이름] ›`)이었는데, 이름이 길수록 화살표가 화면 양 끝으로
 * 밀렸다. 스크롤과 무관하게 화면에 고정되도록 집 화면 루트의 덧칠 층으로 그린다. 집 탭 본문의
 * 가로 스와이프는 탭 전환 그대로다(#761 — 집 전환 스와이프는 넣지 않기로 했다, #1576 닫음).
 *
 * 덧칠 층 자체는 터치를 받지 않는다(`box-none`) — 버튼 사이의 집 프레임·방 타일은 그대로 눌린다.
 */
export function HouseSideArrows({ showArrows, onPrev, onNext, top }: HouseSideArrowsProps) {
  const t = useTokens();
  const tr = useT();
  if (!showArrows) return null;
  const placed = top == null ? null : { top, marginTop: 0 };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="house-side-arrows">
      <Pressable
        onPress={onPrev}
        accessibilityRole="button"
        accessibilityLabel={tr('house.switcher.prev')}
        hitSlop={8}
        style={[styles.button, styles.left, placed]}>
        <GlassSurface style={styles.face} fallbackColor={t.surface}>
          <Icon name="back" size={18} color={t.text} />
        </GlassSurface>
      </Pressable>
      <Pressable
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel={tr('house.switcher.next')}
        hitSlop={8}
        style={[styles.button, styles.right, placed]}>
        <GlassSurface style={styles.face} fallbackColor={t.surface}>
          <Icon name="forward" size={18} color={t.text} />
        </GlassSurface>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: '50%',
    marginTop: -SIZE / 2,
    width: SIZE,
    height: SIZE,
    // 집 프레임·방 타일 위에 뜬다 — 레일(30)보다는 아래.
    zIndex: 25,
  },
  left: { left: Spacing.two },
  right: { right: Spacing.two },
  // 떠 있는 원형 버튼의 면 (#1050) — 위치·크기는 버튼이, 모양·배경은 면이.
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
