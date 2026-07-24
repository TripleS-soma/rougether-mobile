import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  type StyleProp,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';

import { Overlay } from '@/constants/theme';

// 스와이프-다운 닫기 (#469) — 이만큼 끌어내리거나(플링) 이 속도를 넘기면 닫는다.
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.6;

/** 놓는 순간의 끌어내린 거리(dy)·속도(vy)로 닫을지 판정. */
export function shouldDismiss(dy: number, vy: number): boolean {
  return dy > DISMISS_DISTANCE || vy > DISMISS_VELOCITY;
}

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
  // 손가락으로 끌어내린 추가 오프셋(아래로만). 놓으면 0으로 튕겨 돌아가거나 닫힘.
  const dragY = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(visible);
  const [cardH, setCardH] = useState(0);
  // PanResponder는 한 번만 만들어지므로 최신 onClose를 ref로 참조한다.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
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
  }, [visible, progress, dragY]);

  // 아래로 끄는 팬만 가로챈다 — 수직 우세일 때만 claim해 내부 스크롤/탭과 안 부딪힘.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (shouldDismiss(g.dy, g.vy)) {
          onCloseRef.current?.();
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            friction: 9,
            tension: 70,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          friction: 9,
          tension: 70,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  if (!rendered) return null;

  // 카드 높이를 재기 전 첫 프레임은 화면 높이만큼 내려 시작 — 깜빡임 방지.
  // 진입 애니메이션 오프셋에 손가락 드래그 오프셋을 더해 카드를 움직인다.
  const translateY = Animated.add(
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [cardH || windowH, 0],
    }),
    dragY,
  );

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
          {...pan.panHandlers}
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
