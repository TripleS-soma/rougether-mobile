import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 집 스위처 줄 — ‹ 화살표 · 아이콘 + 이름 뱃지 · › 화살표. 일반 집 페이지와
 * 승인 대기 페이지(#648)가 같은 마크업을 두 벌 들고 있던 것을 한 컴포넌트로
 * 합쳤다(리팩토링 4묶음). 두 벌의 차이는 뱃지 아이콘과 제목뿐이라 그 둘만 prop.
 */
export type HouseSwitcherProps = {
  /** 뱃지 앞 아이콘 — 방장 왕관 / 집 / 대기 자물쇠. */
  icon: ReactNode;
  title: string;
  /** 페이지가 둘 이상일 때만 화살표를 그린다 (`totalPages > 1`). */
  showArrows: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function HouseSwitcher({ icon, title, showArrows, onPrev, onNext }: HouseSwitcherProps) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.switcher}>
      {showArrows ? (
        <Pressable
          onPress={onPrev}
          accessibilityRole="button"
          accessibilityLabel="이전 집"
          hitSlop={8}
          style={styles.iconBtn}>
          <GlassSurface style={styles.iconBtnFace} fallbackColor={t.surface}>
            <Icon name="back" size={18} color={t.text} />
          </GlassSurface>
        </Pressable>
      ) : null}
      <GlassSurface interactive={false} fallbackColor={t.surface} style={styles.titleBadge}>
        {icon}
        {/* 서버는 집 이름을 30자까지 받는다 — 안 자르면 뱃지가 부풀어
            좌우 전환 화살표를 화면 밖으로 밀어낸다 (#994). */}
        <Text style={[Typography.h3, styles.titleText, { color: t.text }]} numberOfLines={1}>
          {title}
        </Text>
      </GlassSurface>
      {showArrows ? (
        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel="다음 집"
          hitSlop={8}
          style={styles.iconBtn}>
          <GlassSurface style={styles.iconBtnFace} fallbackColor={t.surface}>
            <Icon name="forward" size={18} color={t.text} />
          </GlassSurface>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    // 부모가 폭을 안 정해주면 뱃지의 flexShrink가 줄일 대상이 없어 말줄임이
    // 안 걸린다 (#994 리뷰). 승인 대기 페이지는 emptyWrap(alignItems: center)
    // 안이라 이게 없으면 긴 이름이 화살표를 화면 밖으로 민다. 일반 페이지는
    // skySection이 이미 stretch라 무해하다.
    alignSelf: 'stretch',
  },
  iconBtn: {
    width: 40,
    height: 40,
  },
  // 떠 있는 원형 버튼의 면 (#1050) — 위치·크기는 버튼이, 모양·배경은 면이.
  // house-screen의 ⟲ 리셋 버튼(camReset)도 같은 면 스타일을 쓴다.
  iconBtnFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: { flexShrink: 1 },
  titleBadge: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
