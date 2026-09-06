import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

import {
  backTargetFor,
  EDGE_BACK_DISTANCE,
  EDGE_BACK_VELOCITY,
  EDGE_BACK_WIDTH,
  EXIT_WINDOW_MS,
  FULL_SWIPE_BACK_EXCLUDED,
  NAV_ORDER,
  SCREEN_FOR_TAB,
  TAB_FOR_SCREEN,
  type Screen,
} from '@/components/app/navigation';
import { useToast } from '@/components/ui/toast';

/**
 * 셸 내비게이션 컨트롤러 (#692) — 뒤로가기(하드웨어 백 #522 · iOS 엣지 백
 * #564)·탭 페이저 정착(#563)을 소유한다. 화면 전환 연출은 use-screen-transition. screen 상태
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

  // iOS 스와이프 백 (#564 → 전폭 #1135) — 서브화면(탭 루트 제외)에서 우향 팬.
  // 가로 제스처를 쓰는 화면(FULL_SWIPE_BACK_EXCLUDED)만 왼쪽 엣지 시작 한정. 탭 루트의 가로 스와이프는 페이저(#563) 몫이라 서브화면 한정.
  // Android는 시스템 백 제스처/버튼이 있어 끈다. 제스처는 관찰만 하고
  // 콘텐츠 터치를 막지 않는다 — 엣지 밖 시작은 즉시 물러난다.
  const edgeBackEnabledRef = useRef(false);
  edgeBackEnabledRef.current = Platform.OS === 'ios' && TAB_FOR_SCREEN[screen] == null;
  // 전폭 스와이프 백 (#1135) — 가로 제스처를 쓰는 화면만 가장자리 한정으로 남긴다.
  const fullSwipeRef = useRef(false);
  fullSwipeRef.current = edgeBackEnabledRef.current && !FULL_SWIPE_BACK_EXCLUDED.has(screen);
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  // 이 터치가 엣지 백 자격을 갖췄는지 (#740) — onTouchesDown의 mgr.fail()은
  // runOnJS라 UI 스레드 활성화와 경쟁한다(JS가 바쁘면 늦게 도착). fail이 져도
  // 백이 나가지 않도록, 자격을 ref에 기록해 커밋 시점(onEnd)에 다시 본다.
  // 이 가드가 없을 때: 설정 탭에서 우향 스와이프 → 페이저(집)가 아니라
  // backTargetFor('myPage')='myRoom'으로 튀어 집을 건너뛰었다(당시 설정 탭).
  const edgeStartOkRef = useRef(false);
  const edgeBackPan = useRef(
    Gesture.Pan()
      .withTestId('edge-back-pan')
      .enabled(Platform.OS === 'ios')
      .runOnJS(true)
      .maxPointers(1)
      // 전폭(#1135)에서는 세로 스크롤과 더 자주 겹친다 — 가로 24px 뒤에 활성화하고
      // 세로 16px이면 먼저 물러난다.
      .activeOffsetX(24)
      .failOffsetY([-16, 16])
      .onTouchesDown((e, mgr) => {
        const x = e.allTouches[0]?.x ?? Number.MAX_VALUE;
        const ok = edgeBackEnabledRef.current && (fullSwipeRef.current || x <= EDGE_BACK_WIDTH);
        edgeStartOkRef.current = ok;
        if (!ok) mgr.fail();
      })
      .onEnd((e) => {
        // 자격 재확인 — 탭 루트(방·집·마이페이지)에서는 절대 백이 나가지 않는다.
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

  // 화면 전환은 use-screen-transition(#1094 — 두 층 슬라이드)이 맡는다.

  return {
    goBack,
    edgeBackPan,
    activeTab,
    handlePageChange,
  };
}
