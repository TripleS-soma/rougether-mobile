import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { ContentMaxWidth, Spacing } from '@/constants/theme';
import { APP_FRAME_MAX_WIDTH, useAppFrame } from '@/hooks/use-app-frame';
import { useBottomNavInset } from '@/hooks/use-screen-style';
import { useSplitLeftPaneInsets } from '@/hooks/use-split-pane-insets';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/**
 * 2단 피드 탭 — 왼쪽에 글 목록(children), 오른쪽에 고른 글의 상세(`detail`). 펼친 폴더블·
 * 태블릿·데스크톱 웹. 한 칸(폰)에서는 목록만 그리고 상세는 종전대로 서브화면으로 넘어간다.
 *
 * 한 칸일 때도 같은 래퍼를 둔다 — 접었다 펼 때 목록이 리마운트되지 않게.
 * 터치 기기는 두 칸이 1:1로 창을 다 쓰고, 마우스 웹은 폰 폭 목록 칸 + 상세 칸을 가운데 모은다.
 */
export function FeedSplit({ children, detail }: { children: ReactNode; detail: ReactNode }) {
  const t = useTokens();
  const tr = useT();
  const Typography = useTypography();
  const { split, splitFill = false, navRail = false } = useAppFrame();
  // 왼쪽 칸은 위 안전 영역을 통째로 비우지 않는다(`useSplitLeftPaneInsets` 참고).
  const listInsets = useSplitLeftPaneInsets();
  // 아래 탭 바가 떠 있는 좁은 2단에서는 상세의 댓글 입력이 그 밑에 깔리지 않게 비운다.
  const navInset = useBottomNavInset();
  return (
    <View
      style={[styles.fill, split && (splitFill ? styles.rowFill : styles.row)]}
      testID="feed-split">
      <View
        style={split ? (splitFill ? styles.paneFill : styles.list) : styles.fill}
        testID="feed-split-list">
        <SafeAreaInsetsContext.Provider value={listInsets}>
          {children}
        </SafeAreaInsetsContext.Provider>
      </View>
      {split ? (
        <View
          style={[
            splitFill ? styles.paneFill : styles.detail,
            { backgroundColor: t.screen },
            navRail ? null : { paddingBottom: navInset },
          ]}
          testID="feed-split-detail">
          {detail ?? (
            <View style={styles.empty}>
              <Text style={[Typography.label, styles.emptyText, { color: t.textMuted }]}>
                {tr('feed.split.pick')}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // 마우스 웹 — 폰 폭 목록 칸 + 상세 칸을 한 블록으로 가운데에.
  row: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.six },
  list: { width: APP_FRAME_MAX_WIDTH, flexGrow: 0 },
  detail: { width: ContentMaxWidth, flexGrow: 0, flexShrink: 1 },
  // 터치 기기(펼친 폴더블·태블릿) — 두 칸이 1:1로 창을 다 쓴다.
  rowFill: { flexDirection: 'row' },
  paneFill: { flex: 1, flexBasis: 0, minWidth: 0 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  emptyText: { textAlign: 'center' },
});
