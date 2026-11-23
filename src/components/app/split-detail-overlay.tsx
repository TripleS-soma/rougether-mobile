import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ContentMaxWidth, Spacing } from '@/constants/theme';
import { APP_FRAME_MAX_WIDTH, useAppFrame } from '@/hooks/use-app-frame';
import { useBottomNavInset } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

/**
 * 2단 탭 화면의 **오른쪽 칸 위에** 서브화면을 덮어 그린다 — 펼친 폴더블·태블릿·데스크톱 웹.
 *
 * 내 정보에서 설정·도움말 같은 항목을 누르면 화면을 통째로 넘기지 않고, 왼쪽 칸(프로필)은 그대로
 * 두고 오른쪽 칸에 그 화면을 연다. 서브화면의 뒤로 버튼은 종전대로 `goBack`이라, 뒤로 가면 덮개가
 * 걷히고 밑의 메뉴 목록이 다시 보인다.
 *
 * 탭 화면(children)은 건드리지 않고 같은 칸 배치를 한 겹 더 얹는 방식이다 — 탭 화면이 memo
 * 경계를 지키고(셸이 서브화면을 그릴 때마다 다시 그려지지 않는다) 화면마다 덮개를 따로 만들지
 * 않아도 된다. 칸 치수는 탭 화면의 2단과 같아야 한다(터치: 1:1, 마우스 웹: 폰 폭 칸 + 틈 +
 * 콘텐츠 폭 칸을 가운데에).
 *
 * `detail`이 없거나 2단이 아니면 children만 그린다. 그때도 같은 래퍼를 둬서 탭 화면이
 * 리마운트되지 않는다.
 */
export function SplitDetailOverlay({
  children,
  detail,
}: {
  children: ReactNode;
  detail: ReactNode;
}) {
  const t = useTokens();
  const { split, splitFill = false, navRail = false } = useAppFrame();
  // 아래 탭 바가 떠 있는 좁은 2단에서는 서브화면의 바닥(입력줄·버튼)이 그 밑에 깔리지 않게 비운다.
  const navInset = useBottomNavInset();
  const shown = split && detail != null && detail !== false;
  return (
    <View style={styles.fill} testID="split-detail-host">
      {children}
      {shown ? (
        <View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, splitFill ? styles.rowFill : styles.row]}
          testID="split-detail-overlay">
          {/* 왼쪽 칸 자리 — 비워 두고 터치는 밑의 탭 화면으로 흘린다. */}
          <View pointerEvents="none" style={splitFill ? styles.paneFill : styles.left} />
          <View
            style={[
              splitFill ? styles.paneFill : styles.right,
              { backgroundColor: t.screen },
              navRail ? null : { paddingBottom: navInset },
            ]}
            testID="split-detail-pane">
            {detail}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // 마우스 웹 — 탭 화면의 2단과 같은 블록(폰 폭 칸 + 틈 + 콘텐츠 폭 칸)을 가운데에.
  row: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.six },
  left: { width: APP_FRAME_MAX_WIDTH, flexGrow: 0 },
  right: { width: ContentMaxWidth, flexGrow: 0, flexShrink: 1 },
  // 터치 기기(펼친 폴더블·태블릿) — 두 칸이 1:1.
  rowFill: { flexDirection: 'row' },
  paneFill: { flex: 1, flexBasis: 0, minWidth: 0 },
});
