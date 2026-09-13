import {
  createContext,
  type MutableRefObject,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { ModalFrame } from '@/components/app/app-frame';
import { Overlay } from '@/constants/theme';
import { useAnimatedValue, useConstant, useLatestRef } from '@/hooks/use-stable-value';
import { NATIVE_DRIVER } from '@/utils/animation';

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
/**
 * iOS RN Modal 직렬화 (2026-09-08 "시간 추가 누르면 멈춤"). UIKit은 이미 Modal을
 * 띄우고 있는 VC 위에 다른 Modal을 올리지 못한다 — 메뉴 시트가 200ms 퇴장하는 동안
 * 다음 시트(알림 시간)가 마운트되면 "Attempt to present … which is already presenting"
 * 으로 **새 시트가 영영 안 뜨고 visible만 true로 남아** 앱이 멈춘 것처럼 됐다(시뮬레이터
 * 로그로 확인, Android Dialog는 겹쳐도 됨). 퇴장 중인 시트가 있으면 새 시트의 마운트를
 * 그 언마운트 뒤로 미룬다. 모듈 스코프인 건 시트끼리 부모가 다르기 때문.
 */
let closingSheets = 0;
const pendingOpens = new Set<() => void>();
function markClosing(delta: 1 | -1) {
  closingSheets = Math.max(0, closingSheets + delta);
  if (closingSheets > 0) return;
  const opens = Array.from(pendingOpens);
  pendingOpens.clear();
  opens.forEach((open) => open());
}
/** 테스트 전용 — 스위트 간 누수 방지. */
export function __resetSheetSerializer() {
  closingSheets = 0;
  pendingOpens.clear();
}

export type BottomSheetDragScope = 'header' | 'card';

/**
 * 안드로이드 키보드 높이 (#1290) — keyboardDidShow의 height를 그대로 쓰고 닫히면 0.
 * KeyboardAvoidingView(height)는 안드로이드에서 닫힘도 `_onKeyboardChange`로 받아, 닫힘
 * 이벤트의 screenY(보이는 영역의 **높이**)로 줄임을 다시 계산한다. 엣지투엣지 Modal은
 * 프레임이 화면 전체라 키보드가 없는데도 상태바+내비바만큼 줄임이 남고, height 모드가
 * 직전 줄임을 계산에 되먹여 레이아웃과 엇갈리며 시트가 계속 위아래로 흔들렸다(갤럭시
 * S25 녹화). 여기선 레이아웃 결과를 계산에 쓰지 않으니 되먹임이 생길 수 없다.
 */
function useAndroidKeyboardHeight(enabled: boolean): number {
  const [height, setHeight] = useState(() =>
    enabled && Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0,
  );
  useEffect(() => {
    if (!enabled) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [enabled]);
  return enabled ? height : 0;
}

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
      style={[styles.exclude, style]}
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
  /** Native card pan for action sheets without scrollable children or SheetDragExclude. */
  nativeDrag?: boolean;
  /** Keep input sheets above the keyboard without changing other sheets. */
  avoidKeyboard?: boolean;
  /** Prevent swipe dismissal during a pending save. */
  dragEnabled?: boolean;
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
  nativeDrag = false,
  avoidKeyboard = false,
  dragEnabled = true,
  children,
}: BottomSheetProps) {
  const { height: windowH } = useWindowDimensions();
  const keyboardHeight = useAndroidKeyboardHeight(avoidKeyboard && Platform.OS === 'android');
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
  const dragEnabledRef = useLatestRef(dragEnabled);
  // 이 터치가 SheetDragExclude 안에서 시작했는가 (#1132) — 자식이 true, 카드가 false.
  const excludedRef = useRef(false);
  const useNativeDrag = nativeDrag && dragEnabled && dragScope === 'card' && Platform.OS !== 'web';
  const resetDrag = useConstant(() => () => {
    Animated.spring(dragY, {
      toValue: 0,
      friction: 9,
      tension: 70,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  });
  const nativePan = useConstant(() =>
    Gesture.Pan()
      .withTestId('bottom-sheet-dismiss-pan')
      .maxPointers(1)
      .activeOffsetY(6)
      .failOffsetY(-6)
      // Keep RN Animated's existing entrance/exit animation. Recognition and
      // cancellation of child button touches happen natively; updates use JS.
      .runOnJS(true)
      .onStart(() => dragY.stopAnimation())
      .onUpdate((e) => dragY.setValue(Math.max(0, e.translationY)))
      .onEnd((e, success) => {
        // RNGH reports px/s; the existing dismissal helper expects px/ms.
        if (success && e.translationY > 0 && shouldDismiss(e.translationY, e.velocityY / 1000)) {
          onCloseRef.current?.();
        } else {
          resetDrag();
        }
      }),
  );

  // 이 시트가 지금 퇴장 카운트에 들어가 있는지 — 정확히 한 번만 빼기 위해.
  const renderedRef = useLatestRef(rendered);
  const closingRef = useRef(false);
  const leaveClosing = useCallback(() => {
    if (!closingRef.current) return;
    closingRef.current = false;
    markClosing(-1);
  }, []);
  useEffect(() => {
    if (visible) {
      // 다시 열리면 퇴장 중이던 상태는 취소.
      leaveClosing();
      const open = () => {
        dragY.setValue(0);
        setRendered(true);
        Animated.spring(progress, {
          toValue: 1,
          friction: 9,
          tension: 70,
          useNativeDriver: NATIVE_DRIVER,
        }).start();
      };
      // 다른 시트가 퇴장 중이면(Modal 아직 붙어 있음) 그 언마운트 뒤에 연다.
      if (closingSheets > 0) {
        pendingOpens.add(open);
        return () => {
          pendingOpens.delete(open);
        };
      }
      open();
      return;
    }
    // 마운트된 적 없는 시트(visible=false로 시작)는 Modal이 없으니 퇴장도, 대기시킬 것도 없다.
    if (!renderedRef.current) return;
    if (!closingRef.current) {
      closingRef.current = true;
      markClosing(1);
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (!finished) return;
      setRendered(false);
      leaveClosing();
    });
  }, [visible, progress, dragY, leaveClosing, renderedRef]);
  // 퇴장 애니메이션 도중 언마운트돼도 카운트가 남지 않게.
  useEffect(() => leaveClosing, [leaveClosing]);

  // 아래로 끄는 팬만 가로챈다 — 수직 우세 + 클레임 범위(dragScope) 안에서
  // 시작한 드래그만 claim한다. 기본 'header'는 카드 상단(그립/헤더) 한정
  // (#514 — 카드 전체 클레임이 알림 시간 휠의 스와이프를 빼앗았다),
  // 스크롤 자식이 없는 시트는 'card'로 본문 어디서든 내릴 수 있다 (#657).
  const pan = useConstant(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        dragEnabledRef.current &&
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
          resetDrag();
        }
      },
      onPanResponderTerminate: resetDrag,
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

  const card = (
    <Animated.View
      {...(useNativeDrag ? {} : pan.panHandlers)}
      onLayout={(e) => {
        setCardH(e.nativeEvent.layout.height);
        cardTopRef.current = e.nativeEvent.layout.y;
      }}
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
  );
  const overlay = (
    <Animated.View
      style={avoidKeyboard ? styles.keyboardOverlay : styles.overlay}
      testID="bottom-sheet">
      <Animated.View style={[styles.backdrop, { opacity: progress }]} />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="시트 닫기"
      />
      {/* 웹 데스크톱: 딤은 창 전체, 카드만 앱 프레임 폭(중앙 컬럼)에 맞춘다. */}
      <ModalFrame>
        {useNativeDrag ? <GestureDetector gesture={nativePan}>{card}</GestureDetector> : card}
      </ModalFrame>
    </Animated.View>
  );

  const content = !avoidKeyboard ? (
    overlay
  ) : Platform.OS === 'ios' ? (
    <KeyboardAvoidingView
      testID="bottom-sheet-keyboard"
      style={styles.gestureRoot}
      behavior="padding">
      {overlay}
    </KeyboardAvoidingView>
  ) : (
    // keyboardDidShow의 height는 ime − 시스템 바라 카드 아랫변이 키보드 윗변보다 내비바
    // 인셋만큼 아래에 놓인다. 입력 시트 본문은 이미 하단 인셋만큼 여백을 가지므로(작성 시트
    // max(insets.bottom, 16)) 가려지는 띠가 정확히 그 여백이다 — 인셋을 더하면 키보드 위로
    // 빈칸이 한 번 더 생긴다(#1291 리뷰). 웹은 키보드 이벤트가 없어 0.
    <View
      testID="bottom-sheet-keyboard"
      style={[styles.gestureRoot, { paddingBottom: keyboardHeight }]}>
      {overlay}
    </View>
  );

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      {useNativeDrag ? (
        <GestureHandlerRootView style={styles.gestureRoot}>{content}</GestureHandlerRootView>
      ) : (
        content
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  exclude: {
    flexShrink: 1,
    minHeight: 0,
  },
  gestureRoot: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
    elevation: 100,
  },
  keyboardOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Overlay.dim,
  },
});
