import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { APP_FRAME_MAX_WIDTH, useAppFrame } from '@/hooks/use-app-frame';
import { useTokens } from '@/hooks/use-tokens';

/**
 * 웹 데스크톱에서 자식을 중앙 480px 컬럼에 가두는 프레임. 네이티브·좁은 창에서는
 * 자식을 그대로 돌려준다(추가 View 없음 — 레이아웃 스냅샷 불변).
 * 루트 Stack과 Modal 안(시트) 두 곳에서 쓴다 — RN Modal은 프레임 밖 body에 붙기
 * 때문에 시트도 따로 감싸야 폭이 맞는다.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const t = useTokens();
  const { framed } = useAppFrame();
  if (!framed) return <>{children}</>;
  return (
    <View style={[styles.outer, { backgroundColor: t.appShell }]}>
      <View style={[styles.inner, { backgroundColor: t.screen, borderColor: t.border }]}>
        {children}
      </View>
    </View>
  );
}

/** Modal 안에서 쓰는 변형 — 배경(딤)은 창 전체, 내용만 프레임 폭. */
export function ModalFrame({ children }: { children: ReactNode }) {
  const { framed } = useAppFrame();
  if (!framed) return <>{children}</>;
  return (
    <View style={styles.modalOuter} pointerEvents="box-none">
      <View style={styles.modalInner} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: {
    flex: 1,
    width: APP_FRAME_MAX_WIDTH,
    overflow: 'hidden',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  modalOuter: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
  modalInner: { flex: 1, width: APP_FRAME_MAX_WIDTH },
});
