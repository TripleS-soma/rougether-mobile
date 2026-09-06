import {
  createContext,
  type MutableRefObject,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  type StyleProp,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { Overlay } from '@/constants/theme';
import { useAnimatedValue, useConstant, useLatestRef } from '@/hooks/use-stable-value';

// 스와이프-다운 닫기 (#469) — 이만큼 끌어내리거나(플링) 이 속도를 넘기면 닫는다.
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.6;

/** 놓는 순간의 끌어내린 거리(dy)·속도(vy)로 닫을지 판정. */
export function shouldDismiss(dy: number, vy: number): boolean {
  return dy > DISMISS_DISTANCE || vy > DISMISS_VELOCITY;
}

// 끌어내리기 클레임 영역 높이 (#514) — 카드 상단(그립/헤더 리듬, 시트들의
// head 행 높이)에 해당. 이 안에서 시작한 세로 드래그만 시트가 가져간다.
export const DRAG_CLAIM_HEIGHT = 64;

/**
 * 터치 시작점(y0)이 카드 상단 클레임 영역 안인지 (#514). 카드 전체를
 * 클레임하면 본문의 세로 스크롤 자식(알림 시간 휠 등)의 스와이프를 시트
 * 내림으로 빼앗는다 — 헤더 영역 한정이 결정적인 중재다.
 */
export function inDragClaimZone(y0: number, cardTop: number): boolean {
  return y0 - cardTop <= DRAG_CLAIM_HEIGHT;
}

/**
 * 끌어내리기 클레임 범위 (#657) — 'header'(기본)는 #514의 상단 64px 한정,
 * 'card'는 카드 전체. 세로 스크롤 자식(휠·달력·ScrollView)이 없는 시트만
 * 'card'를 켤 것 — 있으면 그 자식의 스와이프를 시트 내림으로 빼앗는다.
 */
export type BottomSheetDragScope = 'header' | 'card';

/**
 * 시작점 기준으로 이 드래그를 시트가 가져갈지 (#514·#657·#1132). `excluded`는
 * 터치가 `SheetDragExclude`(휠·스크롤 목록) 안에서 시작했다는 뜻 — 그 자식의
 * 세로 제스처를 시트 내림으로 빼앗지 않는다.
 */
export function claimsDrag(
  scope: BottomSheetDragScope,
  y0: number,
  cardTop: number,
  excluded = false,
): boolean {
  if (excluded) return false;
  return scope === 'card' || inDragClaimZone(y0, cardTop);
}

const SheetDragContext = createContext<MutableRefObject<boolean> | null>(null);

/**
 * 시트 안에서 세로 제스처를 스스로 쓰는 영역(#1132) — 휠 피커, ScrollView·FlatList
 * 본문. 이 안에서 시작한 터치는 시트가 끌어내리기로 가져가지 않는다. 카드 전체
 * 클레임('card')이 기본이 되면서, 종전 #514의 "휠 스와이프를 빼앗는" 문제를 이
 * 표시로 막는다. 터치 이벤트는 버블링이라 자식에서 true, 카드에서 false로 닫는다.
 */
export function SheetDragExclude({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const excluded = useContext(SheetDragContext);
  const mark = (on: boolean) => () => {
    if (excluded) excluded.current = on;
  };
  return (
    <View
      style={style}
      testID={testID}
      onTouchStart={mark(true)}
      onTouchEnd={mark(false)}
      onTouchCancel={mark(false)}>
      {children}
    </View>
  );
}

export type BottomSheetProps = {
  visible: boolean;
  /** 백드롭 탭·퇴장 트리거. 닫힘 애니메이션은 이 컴포넌트가 재생한다. */
  onClose?: () => void;
  /** 시트 카드 스타일 — 각 시트의 기존 styles.sheet를 그대로 넘긴다. */
  cardStyle?: StyleProp<ViewStyle>;
  /**
   * 끌어내리기 클레임 범위 — 기본 'card' (#1132: 본문 어디서나 끌어 닫는다).
   * 세로 제스처를 쓰는 자식은 `SheetDragExclude`로 감싼다. 'header'는 종전 #514.
   */
  dragScope?: BottomSheetDragScope;
  children: ReactNode;
};

/**
 * 공용 바텀시트 컨테이너 (#448) — 스프링으로 살짝 오버슛하며 올라오고,
 * 닫힐 때도 같은 결로 미끄러져 내려간 뒤에야 언마운트된다(visible=false
 * 이후 퇴장 재생용 내부 rendered 상태). 백드롭은 함께 페이드.
 */
export function BottomSheet({
  visible,
  onClose,
  cardStyle,
  dragScope = 'card',
  children,
}: BottomSheetProps) {
  const { height: windowH } = useWindowDimensions();
  const progress = useAnimatedValue(0);
  // 손가락으로 끌어내린 추가 오프셋(아래로만). 놓으면 0으로 튕겨 돌아가거나 닫힘.
  const dragY = useAnimatedValue(0);
  const [rendered, setRendered] = useState(visible);
  const [cardH, setCardH] = useState(0);
  // 카드 상단의 화면 y (#514) — 오버레이가 창 전체를 덮으므로 layout.y가 곧
  // 페이지 좌표. transform(입장 슬라이드)은 layout에 안 잡혀 정지 위치 기준.
  const cardTopRef = useRef(0);
  // PanResponder는 한 번만 만들어지므로 최신 onClose·dragScope를 ref로 참조한다.
  const onCloseRef = useLatestRef(onClose);
  const dragScopeRef = useLatestRef(dragScope);
  // 이 터치가 SheetDragExclude 안에서 시작했는가 (#1132) — 자식이 true, 카드가 false.
  const excludedRef = useRef(false);

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

  // 아래로 끄는 팬만 가로챈다 — 수직 우세 + 클레임 범위(dragScope) 안에서
  // 시작한 드래그만 claim한다. 기본 'header'는 카드 상단(그립/헤더) 한정
  // (#514 — 카드 전체 클레임이 알림 시간 휠의 스와이프를 빼앗았다),
  // 스크롤 자식이 없는 시트는 'card'로 본문 어디서든 내릴 수 있다 (#657).
  const pan = useConstant(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        g.dy > 6 &&
        g.dy > Math.abs(g.dx) &&
        claimsDrag(dragScopeRef.current, g.y0, cardTopRef.current, excludedRef.current),
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
  );

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
          onLayout={(e) => {
            setCardH(e.nativeEvent.layout.height);
            cardTopRef.current = e.nativeEvent.layout.y;
          }}
          // 자식(SheetDragExclude)의 onTouchStart가 먼저 돌고 여기로 버블링한다 —
          // 끝날 때 카드에서 플래그를 닫는다.
          onTouchEnd={() => {
            excludedRef.current = false;
          }}
          onTouchCancel={() => {
            excludedRef.current = false;
          }}
          style={[cardStyle, { transform: [{ translateY }] }]}
          testID="bottom-sheet-card">
          <SheetDragContext.Provider value={excludedRef}>{children}</SheetDragContext.Provider>
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
