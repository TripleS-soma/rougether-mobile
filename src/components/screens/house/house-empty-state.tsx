import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Loading } from '@/components/ui/loading';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

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
  const Typography = useTypography();
  return (
    <View style={[styles.screen, screenStyle]}>
      <View style={styles.emptyWrap}>
        {loading ? (
          <>
            <Loading />
            <Text style={[Typography.supporting, { color: t.textMuted }]}>불러오는 중...</Text>
          </>
        ) : loadError ? (
          // 로드 실패 (#549) — 집이 있는 사용자가 '집 없음' 가입 유도를 보지
          // 않도록 빈 상태 분기보다 먼저 처리한다.
          <>
            <Text style={[Typography.h3, { color: t.text }]}>집 정보를 불러오지 못했어요</Text>
            <Text style={[Typography.body, styles.emptyBody, { color: t.textMuted }]}>
              네트워크 상태를 확인하고 다시 시도해 주세요.
            </Text>
            <ScalePressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="다시 시도"
              style={[styles.emptyCta, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>다시 시도</Text>
            </ScalePressable>
          </>
        ) : (
          <>
            <Text style={[Typography.h3, { color: t.text }]}>아직 함께하는 집이 없어요</Text>
            <Text style={[Typography.body, styles.emptyBody, { color: t.textMuted }]}>
              집을 만들거나 초대코드로 입주해 친구들과 루틴을 함께 키워보세요.
            </Text>
            <ScalePressable
              onPress={onOpenSearch}
              accessibilityRole="button"
              accessibilityLabel="집 탐색"
              style={[styles.emptyCta, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>집 탐색하기</Text>
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
