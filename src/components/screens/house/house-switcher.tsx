import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * 집 스위처 줄 — 아이콘 + 이름 뱃지. 일반 집 페이지와 승인 대기 페이지(#648)가 같은
 * 마크업을 두 벌 들고 있던 것을 한 컴포넌트로 합쳤다(리팩토링 4묶음).
 *
 * 전환 화살표는 여기 없다 — 화면 가운데 양쪽으로 옮겼다(`HouseSideArrows`, #1575). 뱃지
 * 양옆에 있을 땐 이름이 길수록 화살표가 화면 양 끝으로 밀렸다.
 */
export type HouseSwitcherProps = {
  /** 뱃지 앞 아이콘 — 방장 왕관 / 집 / 대기 자물쇠. */
  icon: ReactNode;
  title: string;
};

export function HouseSwitcher({ icon, title }: HouseSwitcherProps) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.switcher}>
      <GlassSurface interactive={false} fallbackColor={t.surface} style={styles.titleBadge}>
        {icon}
        {/* 서버는 집 이름을 30자까지 받는다 — 안 자르면 뱃지가 화면 폭을 넘는다 (#994). */}
        <Text style={[Typography.h3, styles.titleText, { color: t.text }]} numberOfLines={1}>
          {title}
        </Text>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // 부모가 폭을 안 정해주면 뱃지의 flexShrink가 줄일 대상이 없어 말줄임이
    // 안 걸린다 (#994 리뷰). 승인 대기 페이지는 emptyWrap(alignItems: center)
    // 안이라 이게 없으면 긴 이름이 화면 밖으로 밀린다. 일반 페이지는
    // skySection이 이미 stretch라 무해하다.
    alignSelf: 'stretch',
    // 가운데 양쪽 화살표(#1575)와 레일이 상단 좌우를 쓰지 않으니 여백만 둔다.
    paddingHorizontal: Spacing.four,
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
