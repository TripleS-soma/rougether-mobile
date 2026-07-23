import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  type StyleProp,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';

import { Overlay } from '@/constants/theme';

export type BottomSheetProps = {
  visible: boolean;
  /** 백드롭 탭·퇴장 트리거. 닫힘 애니메이션은 이 컴포넌트가 재생한다. */
  onClose?: () => void;
  /** 시트 카드 스타일 — 각 시트의 기존 styles.sheet를 그대로 넘긴다. */
  cardStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * 공용 바텀시트 컨테이너 (#448) — 스프링으로 살짝 오버슛하며 올라오고,
 * 닫힐 때도 같은 결로 미끄러져 내려간 뒤에야 언마운트된다(visible=false
 * 이후 퇴장 재생용 내부 rendered 상태). 백드롭은 함께 페이드.
 */
export function BottomSheet({ visible, onClose, cardStyle, children }: BottomSheetProps) {
  const { height: windowH } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);
  const [cardH, setCardH] = useState(0);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.spring(progress, {
        toValue: 1,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [visible, progress]);

  if (!rendered) return null;

  // 카드 높이를 재기 전 첫 프레임은 화면 높이만큼 내려 시작 — 깜빡임 방지.
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [cardH || windowH, 0],
  });

  // 투명 Modal 위에 올려 탭바까지 덮는다 — 애니메이션은 직접 재생하므로
  // Modal 기본 전환은 끈다.
  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={styles.overlay} testID="bottom-sheet">
        <Animated.View style={[styles.backdrop, { opacity: progress }]} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="시트 닫기"
        />
        <Animated.View
          onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
          style={[cardStyle, { transform: [{ translateY }] }]}>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Overlay.dim,
  },
});
