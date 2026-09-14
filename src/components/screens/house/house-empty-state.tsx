import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Loading } from '@/components/ui/loading';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/**
 * 집이 없을 때의 화면 — 로딩 / 로드 실패 + 다시 시도(#549) / 빈 상태(집 탐색
 * 유도). house-screen.tsx의 `!currentHouse` 분기를 그대로 떼어낸 것(리팩토링
 * 4묶음). 분기 순서가 중요하다: 로드 실패를 빈 상태보다 먼저 봐야 집이 있는
 * 사용자가 '집 없음' 가입 유도를 보지 않는다.
 */
export type HouseEmptyStateProps = {
  /** 화면 컨테이너 스타일 — 화면이 `useScreenStyle([])`로 읽은 것. */
  screenStyle: ViewStyle;
  loading: boolean;
  loadError: boolean;
  onRetry?: () => void;
  onOpenSearch?: () => void;
};

export function HouseEmptyState({
  screenStyle,
  loading,
  loadError,
  onRetry,
  onOpenSearch,
}: HouseEmptyStateProps) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  return (
    <View style={[styles.screen, screenStyle]}>
      <View style={styles.emptyWrap}>
        {loading ? (
          <>
            <Loading />
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              {tr('house.empty.loading')}
            </Text>
          </>
        ) : loadError ? (
          // 로드 실패 (#549) — 집이 있는 사용자가 '집 없음' 가입 유도를 보지
          // 않도록 빈 상태 분기보다 먼저 처리한다.
          <>
            <Text style={[Typography.h3, { color: t.text }]}>
              {tr('house.empty.loadErrorTitle')}
            </Text>
            <Text style={[Typography.body, styles.emptyBody, { color: t.textMuted }]}>
              {tr('house.empty.loadErrorBody')}
            </Text>
            <ScalePressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={tr('house.empty.retry')}
              style={[styles.emptyCta, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>
                {tr('house.empty.retry')}
              </Text>
            </ScalePressable>
          </>
        ) : (
          <>
            <Text style={[Typography.h3, { color: t.text }]}>{tr('house.empty.noHouseTitle')}</Text>
            <Text style={[Typography.body, styles.emptyBody, { color: t.textMuted }]}>
              {tr('house.empty.noHouseBody')}
            </Text>
            <ScalePressable
              onPress={onOpenSearch}
              accessibilityRole="button"
              accessibilityLabel={tr('house.empty.searchA11y')}
              style={[styles.emptyCta, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>
                {tr('house.empty.searchCta')}
              </Text>
            </ScalePressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  emptyBody: {
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: Spacing.two,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
  },
});
