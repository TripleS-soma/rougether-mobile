import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef } from 'react';
import { Animated, BackHandler, Easing, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

import {
  BACK_SCREEN,
  backTargetFor,
  EDGE_BACK_DISTANCE,
  EDGE_BACK_VELOCITY,
  EDGE_BACK_WIDTH,
  EXIT_WINDOW_MS,
  NAV_ORDER,
  SCREEN_FOR_TAB,
  TAB_FOR_SCREEN,
  type Screen,
} from '@/components/app/navigation';
import { useToast } from '@/components/ui/toast';
import { useAnimatedValue } from '@/hooks/use-stable-value';

/**
 * 셸 내비게이션 컨트롤러 (#692) — 뒤로가기(하드웨어 백 #522 · iOS 엣지 백
 * #564)·화면 전환 손맛(#446)·탭 페이저 정착(#563)을 소유한다. screen 상태
 * 자체는 셸이 소유해 넘긴다(수십 개 셸 콜백이 setScreen을 의존성 없이 쓰는
 * useState setter 계약 유지). 도메인 상태(집 유무, 미션 판정)도 파라미터.
 */
export function useAppNavigation({
  screen,
  setScreen,
  addReturnScreen,
  noHouses,
}: {
  screen: Screen;
  setScreen: Dispatch<SetStateAction<Screen>>;
  /** addRoutine의 동적 복귀 목적지 — 상태는 셸 소유. */
  addReturnScreen: Screen;
  /** 집 없는 유저 (#571) — 집 탭/뒤로가기의 목적지 분기. */
  noHouses: boolean;
  /** 탐색을 뒤로 떠나는 순간 호출 (#571 후속) — 미션 판정은 셸 몫. */
}) {
  const { show: toast } = useToast();

  const lastBackRef = useRef(0);
  // 하드웨어 백(#522)과 엣지 백(#564)이 공유하는 뒤로가기 — 목적지가 없으면
  // false(루트). 탐색을 떠나는 경로도 화면의 뒤로 버튼과 같은 규칙.
  const goBack = useCallback(() => {
    const target = backTargetFor(screen, addReturnScreen, noHouses);
    if (!target) return false;
    setScreen(target);
    return true;
  }, [screen, addReturnScreen, noHouses, setScreen]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (goBack()) return true;
      const now = Date.now();
      if (now - lastBackRef.current <= EXIT_WINDOW_MS) {
        BackHandler.exitApp();
        return true;
      }
      lastBackRef.current = now;
      toast('한 번 더 뒤로가면 앱이 꺼져요');
      return true;
    });
    return () => sub.remove();
  }, [goBack, toast]);

  // iOS 엣지 스와이프 백 (#564) — 서브화면(탭 루트 제외)에서 왼쪽 엣지의
  // 우향 팬. 탭 루트의 가로 스와이프는 페이저(#563) 몫이라 서브화면 한정.
  // Android는 시스템 백 제스처/버튼이 있어 끈다. 제스처는 관찰만 하고
  // 콘텐츠 터치를 막지 않는다 — 엣지 밖 시작은 즉시 물러난다.
  const edgeBackEnabledRef = useRef(false);
  edgeBackEnabledRef.current = Platform.OS === 'ios' && TAB_FOR_SCREEN[screen] == null;
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  // 이 터치가 엣지 백 자격을 갖췄는지 (#740) — onTouchesDown의 mgr.fail()은
  // runOnJS라 UI 스레드 활성화와 경쟁한다(JS가 바쁘면 늦게 도착). fail이 져도
  // 백이 나가지 않도록, 자격을 ref에 기록해 커밋 시점(onEnd)에 다시 본다.
  // 이 가드가 없을 때: 설정 탭에서 우향 스와이프 → 페이저(집)가 아니라
  // backTargetFor('settings')='myRoom'으로 튀어 집을 건너뛰었다.
  const edgeStartOkRef = useRef(false);
  const edgeBackPan = useRef(
    Gesture.Pan()
      .withTestId('edge-back-pan')
      .enabled(Platform.OS === 'ios')
      .runOnJS(true)
      .maxPointers(1)
      .activeOffsetX(16)
      .failOffsetY([-24, 24])
      .onTouchesDown((e, mgr) => {
        const x = e.allTouches[0]?.x ?? Number.MAX_VALUE;
        const ok = edgeBackEnabledRef.current && x <= EDGE_BACK_WIDTH;
        edgeStartOkRef.current = ok;
        if (!ok) mgr.fail();
      })
      .onEnd((e) => {
        // 자격 재확인 — 탭 루트(방·집·설정)에서는 절대 백이 나가지 않는다.
        if (!edgeStartOkRef.current || !edgeBackEnabledRef.current) return;
        if (e.translationX > EDGE_BACK_DISTANCE || e.velocityX > EDGE_BACK_VELOCITY)
          goBackRef.current();
      })
      .onFinalize(() => {
        edgeStartOkRef.current = false;
      }),
  ).current;

  const activeTab = TAB_FOR_SCREEN[screen];

  // 페이저 스와이프 정착 → 탭 전환 (#563). 집이 없으면 집 페이지 대신 집
  // 탐색으로 직행 — 하단 탭 버튼(#571)과 같은 규칙.
  const handlePageChange = useCallback(
    (idx: number) => {
      const tab = NAV_ORDER[idx];
      if (!tab) return;
      setScreen(tab === 'house' && noHouses ? 'houseSearch' : SCREEN_FOR_TAB[tab]);
    },
    [noHouses, setScreen],
  );

  // 화면 전환 손맛 (#446) — 들어오는 화면이 이동 방향에서 밀려 들어온다.
  // 진입(서브화면)은 우측에서, 복귀(뒤로)는 좌측에서. 탭 간 전환은 이제
  // 페이저(#563)가 손가락 추종/슬라이드로 직접 그리므로 여기선 건너뛴다.
  const transOpacity = useAnimatedValue(1);
  const transX = useAnimatedValue(0);
  const prevScreenRef = useRef<Screen>(screen);
  useEffect(() => {
    const prev = prevScreenRef.current;
    if (prev === screen) return;
    prevScreenRef.current = screen;
    const prevTab = TAB_FOR_SCREEN[prev];
    const nextTab = TAB_FOR_SCREEN[screen];
    if (prevTab != null && nextTab != null) return; // 탭 간 — 페이저가 그린다.
    let slide = 28; // 기본: 서브화면 진입(우측에서)
    if (
      BACK_SCREEN[prev] === screen ||
      (prev === 'addRoutine' && screen === addReturnScreen) ||
      nextTab != null
    ) {
      // 뒤로 복귀(백맵 목적지·서브→탭) — 좌측에서 되돌아온다.
      slide = -28;
    }
    // 페이드가 짧으면 깜빡임으로 읽힌다 — 서브화면은 바닥 0.08에서 넉넉히.
    transOpacity.setValue(0.08);
    transX.setValue(slide);
    Animated.parallel([
      Animated.timing(transOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(transX, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [screen, addReturnScreen, transOpacity, transX]);

  return {
    goBack,
    edgeBackPan,
    activeTab,
    handlePageChange,
    transOpacity,
    transX,
  };
}
