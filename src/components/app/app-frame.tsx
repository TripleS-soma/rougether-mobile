import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { APP_FRAME_MAX_WIDTH, useAppFrame } from '@/hooks/use-app-frame';
import { useTokens } from '@/hooks/use-tokens';

/**
 * 웹 데스크톱에서 자식을 중앙 480px 컬럼에 가두는 프레임. 네이티브에서는 자식을
 * 그대로 돌려준다(추가 View 없음 — 레이아웃 스냅샷 불변).
 *
 * 웹에서는 **framed 여부와 무관하게 같은 엘리먼트 트리**를 그린다(#1227 리뷰).
 * Fragment ↔ View로 루트 타입이 바뀌면 React가 하위 트리를 통째로 리마운트해,
 * 창을 480px 경계 앞뒤로 리사이즈할 때 라우터 Stack(또는 열린 시트)이 초기화된다.
 * 좁은 창에서는 래퍼가 폭 100%라 레이아웃이 종전과 같다.
 *
 * 루트 Stack과 Modal 안(시트) 두 곳에서 쓴다 — RN Modal은 프레임 밖 body에 붙기
 * 때문에 시트도 따로 감싸야 폭이 맞는다.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const t = useTokens();
  const { framed } = useAppFrame();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View
      testID="app-frame"
      style={[styles.outer, framed ? { backgroundColor: t.appShell } : null]}>
      <View
        testID="app-frame-inner"
        style={[
          styles.inner,
          framed
            ? [styles.innerFramed, { backgroundColor: t.screen, borderColor: t.border }]
            : styles.innerFull,
        ]}>
        {children}
      </View>
    </View>
  );
}

/**
 * Modal 안에서 쓰는 변형 — 배경(딤)은 창 전체, 내용만 프레임 폭.
 * 안쪽은 `justifyContent: 'flex-end'` — 바텀시트 overlay가 카드를 바닥에 붙이는
 * 배치를 이 래퍼가 끊지 않게(#1227 리뷰: 시트가 위쪽에 붙던 것).
 */
export function ModalFrame({ children }: { children: ReactNode }) {
  const { framed } = useAppFrame();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={styles.modalOuter} pointerEvents="box-none" testID="modal-frame">
      <View
        style={[styles.modalInner, framed ? styles.innerFramed : styles.innerFull]}
        pointerEvents="box-none"
        testID="modal-frame-inner">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, overflow: 'hidden' },
  innerFull: { width: '100%' },
  innerFramed: {
    width: APP_FRAME_MAX_WIDTH,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  modalOuter: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
  modalInner: { flex: 1, justifyContent: 'flex-end' },
});
