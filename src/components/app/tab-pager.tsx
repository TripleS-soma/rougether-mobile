import {
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PagerGestureContext } from '@/components/ui/pager-scroll-view';
import { PageActiveContext } from '@/hooks/use-page-active';
import { SWIPE_CLAIM_DX, SWIPE_FAIL_DY } from '@/utils/gesture';

/** 페이지 스냅 판정 — 폭 대비 이 비율을 넘게 끌면 넘어간다. */
export const PAGE_SNAP_RATIO = 0.3;
/** 스냅 속도 임계(px/s) — 짧게 끌어도 이 속도면 플링으로 인정. */
export const PAGE_FLING_VELOCITY = 500;
/** 페이지 정착 애니메이션 길이(ms) — 셸 화면 전환(340ms)과 같은 결. */
const SETTLE_MS = 260;
/** Release vertical scrolls promptly instead of waiting for the 24px page claim. */
const VERTICAL_SCROLL_SLOP = 12;
/**
 * 끝에서 바깥으로 끌 때 따라오는 비율 (`bounceEdges`, #1575). 1이면 그대로 따라오고
 * 0이면 안 움직인다 — 손가락의 1/3만 따라와 "더는 없다"가 느껴진다.
 */
export const EDGE_RESISTANCE = 0.35;
/** 끝에서 끌려 나오는 최대 폭(화면 폭 대비) — 빈 하늘이 넓게 드러나지 않게. */
const EDGE_MAX_RATIO = 0.18;

/**
 * 범위 밖으로 끌린 양에 저항을 건다 — 안쪽은 그대로, 바깥은 `EDGE_RESISTANCE`배로
 * 줄이고 화면 폭의 `EDGE_MAX_RATIO`에서 멈춘다. 'worklet' — 팬 onUpdate에서 호출.
 */
export function resistEdges(raw: number, min: number, width: number): number {
  'worklet';
  const cap = width * EDGE_MAX_RATIO;
  if (raw > 0) return Math.min(raw * EDGE_RESISTANCE, cap);
  if (raw < min) return min - Math.min((min - raw) * EDGE_RESISTANCE, cap);
  return raw;
}

/**
 * 놓는 순간의 이동·속도로 목표 페이지를 판정한다 (0-base, 클램프됨).
 * 'worklet' 필수 — 팬 onEnd(UI 스레드)에서 호출된다. 지시자가 없으면
 * 웹/jest(전부 JS 스레드)에선 멀쩡하다가 네이티브에서만 스와이프를 놓는
 * 순간 Reanimated 치명 오류로 앱이 종료된다(안드로이드 실기기에서 재현,
 * dragClampBounds와 같은 규칙).
 */
export function settleTarget(
  index: number,
  translationX: number,
  velocityX: number,
  width: number,
  count: number,
): number {
  'worklet';
  let target = index;
  if (translationX <= -width * PAGE_SNAP_RATIO || velocityX <= -PAGE_FLING_VELOCITY) target += 1;
  else if (translationX >= width * PAGE_SNAP_RATIO || velocityX >= PAGE_FLING_VELOCITY) target -= 1;
  return Math.min(Math.max(target, 0), count - 1);
}

export type TabPagerProps = {
  /** 활성 페이지 (0-base). 외부 변경(탭 버튼 등)은 슬라이드로 따라간다. */
  index: number;
  /** 스와이프로 페이지가 바뀌는 순간(정착 애니메이션 시작 시점) 호출. */
  onIndexChange: (index: number) => void;
  /**
   * true인 동안 새 페이지 스와이프를 받지 않는다 — 집 확대 카메라 팬·자리
   * 드래그처럼 페이지 안 제스처가 전권을 가져야 하는 상태 (#563).
   */
  lock?: SharedValue<boolean>;
  /**
   * 첫·끝 페이지에서 바깥으로 끌면 살짝 따라왔다가 튕겨 돌아온다 (#1575 집 페이저).
   * 기본(false)은 탭 페이저 그대로 — 끝에서는 따라오지 않고, iOS에선 그 터치를
   * 아예 놓아 바깥 제스처가 받을 수 있게 한다.
   */
  bounceEdges?: boolean;
  /**
   * 테스트 ID 접두 — 뷰포트(`<id>`)·행(`<id>-row`)·팬(`<id>-pan`)에 붙는다. 집 탭
   * 안에 페이저가 하나 더 들어가서(#1575) 같은 ID가 둘이 되지 않게 한다.
   */
  testID?: string;
  /**
   * 페이지와 같이 밀리지 않는 덧칠 층 — 페이저의 제스처 영역 **안**에 그려서, 그 위에서
   * 시작한 가로 끌기도 페이저가 받는다. 집 탭의 플로팅 레일(#1575): 형제로 두면 레일
   * 버튼 위에서 민 스와이프가 페이저에 닿지 않는다. 탭은 그대로 버튼이 받는다(페이저는
   * SWIPE_CLAIM_DX를 넘어야 활성화된다).
   */
  overlay?: ReactNode;
  children: ReactNode[];
};

/**
 * 하단 탭 서피스 수평 페이저 (#563) — 인스타그램식으로 손가락을 따라 이전
 * 화면이 끝까지 보이며 밀려나간다. JS 전용(RNGH pan + reanimated)이라 OTA로
 * 배포 가능. 페이지 안에 남은 가로 제스처(행 스와이프 ±10, 친구 방 순회
 * 플링 ±24)는 더 깊은 RNGH 디텍터라 동률에서도 자식이 이겨 그대로 살아남고,
 * 페이저는 남은 영역의 가로 우세 드래그만 받는다.
 *
 * 방↔달력 서브탭 플링은 제거했다 (#825) — 나의 방 안에서 같은 손동작이
 * 손가락 위치에 따라 "달력으로"와 "집으로"로 갈려서, 가로 스와이프의 뜻을
 * 하단 탭 이동 하나로 통일했다. 달력 월 이동도 monthSwipe=false로 꺼져 있다.
 */
export function TabPager({
  index,
  onIndexChange,
  lock,
  bounceEdges = false,
  testID = 'tab-pager',
  overlay,
  children,
}: TabPagerProps) {
  const arbitrateScroll = Platform.OS === 'ios';
  // 조건부 페이지(피드 #1409 — FEED_ENABLED)는 null로 들어온다 — 빈 자리를 페이지로 세지 않는다.
  const pages = children.filter((child) => child != null && child !== false);
  const count = pages.length;
  const [width, setWidth] = useState(0);
  // 공유값은 첫 렌더 인스턴스에 앵커링(useRef) — 프로덕션 useSharedValue는
  // 원래 참조가 안정적이지만, jest 환경은 렌더마다 새 객체를 돌려줘(실측)
  // 1회 생성한 제스처의 클로저와 최신 쓰기가 서로 다른 객체를 보게 된다.
  const tx = useRef(useSharedValue(0)).current;
  const start = useRef(useSharedValue(0)).current;
  const touchStart = useRef(useSharedValue({ x: 0, y: 0 })).current;
  const swiping = useRef(useSharedValue(false)).current;
  // 드래그·정착 중에만 이웃 페이지를 보인다 — 평시엔 display:none으로 숨겨
  // 오프스크린 페이지가 그려지지 않고, 테스트 쿼리에도 잡히지 않는다.
  // 보일 범위만 연다 (성능 장부 M1) — 예전엔 전환마다 5개 페이지를 전부 display:flex로
  // 올려 집(방 N개)·달력까지 첫 프레임에 레이아웃했다. 스와이프는 양옆 하나씩, 탭 이동은
  // 출발~도착 사이만. lo > hi면 닫힘.
  const revealLo = useRef(useSharedValue(1)).current;
  const revealHi = useRef(useSharedValue(0)).current;
  // 제스처 정착으로 이미 tx가 목표에 가 있는 인덱스 — prop 반영 시 중복
  // 애니메이션을 건너뛴다.
  const settledRef = useRef(index);
  // 제스처는 마운트 시 1회만 만든다 — 셸이 배경 데이터 갱신 등으로 드래그
  // 도중 리렌더돼도 활성 팬이 살아남고(draggable-furniture 참고), 렌더마다
  // 팬 객체를 새로 붙이는 비용도 없앤다. 워클릿이 읽어야 하는 최신 값
  // (index·width)은 공유값 미러로, JS 콜백은 ref로 넘긴다.
  const indexSV = useRef(useSharedValue(index)).current;
  const widthSV = useRef(useSharedValue(0)).current;
  indexSV.value = index;
  const commitRef = useRef<(target: number) => void>(() => {});

  // 외부 인덱스 변경(탭 버튼·체이닝)은 같은 결로 슬라이드해 따라간다.
  // 제스처가 이미 정착시킨 인덱스면 건드리지 않는다 — 진행 중인 정착
  // 애니메이션을 끊고 스냅해 버린다. 폭 변경(회전 등)만 즉시 재정렬.
  const prevWidthRef = useRef(0);
  useEffect(() => {
    if (width === 0) return;
    // 외부 인덱스 변경(탭 버튼·스크럽)은 진행 중이던 스와이프를 무효로 한다 —
    // 취소된 팬의 onFinalize가 누락돼도 래치가 남지 않게.
    swiping.value = false;
    const widthChanged = prevWidthRef.current !== width;
    prevWidthRef.current = width;
    if (settledRef.current === index) {
      if (widthChanged) tx.value = -index * width;
      return;
    }
    settledRef.current = index;
    // 지금 화면 위치(진행 중인 전환 도중일 수 있다)부터 목표까지 연다 — 목표만 보면 도중 재탭에서
    // 지나가던 페이지가 닫혀 빈칸이 보인다. 이미 열린 범위는 넓히기만 한다.
    const at = -tx.value / width;
    const open = revealLo.value <= revealHi.value;
    const lo = Math.min(Math.floor(at), index);
    const hi = Math.max(Math.ceil(at), index);
    revealLo.value = open ? Math.min(revealLo.value, lo) : lo;
    revealHi.value = open ? Math.max(revealHi.value, hi) : hi;
    tx.value = withTiming(
      -index * width,
      { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          revealLo.value = 1;
          revealHi.value = 0;
        }
      },
    );
  }, [index, width, tx, revealLo, revealHi, swiping]);

  commitRef.current = (target: number) => {
    settledRef.current = target;
    if (target !== index) onIndexChange(target);
  };
  const commit = useCallback((target: number) => commitRef.current(target), []);

  const pan = useMemo(
    () => {
      const gesture = Gesture.Pan().withTestId(`${testID}-pan`).maxPointers(1);
      // Only iOS scrolls wait for the pager. Decide both outcomes in one worklet
      // there; preserve the existing Android/web recognizer configuration.
      if (arbitrateScroll) gesture.manualActivation(true);
      else
        gesture
          .activeOffsetX([-SWIPE_CLAIM_DX, SWIPE_CLAIM_DX])
          .failOffsetY([-SWIPE_FAIL_DY, SWIPE_FAIL_DY]);
      return (
        gesture
          .onTouchesDown((e, mgr) => {
            'worklet';
            // 새 터치는 언제나 깨끗한 상태에서 — `swiping`은 onFinalize에서만 풀리는데,
            // iOS에서 활성 팬이 형제 디텍터의 재부착·취소로 드롭되면 onFinalize가 JS에
            // 닿지 않아 true로 굳고, 그 뒤 수동 활성화(아래 onTouchesMove)가 영영
            // 건너뛰어져 페이저가 죽는다(iOS 전용 증상, 2026-09-08 분석).
            swiping.value = false;
            if (lock?.value || (arbitrateScroll && e.allTouches.length !== 1)) {
              mgr.fail();
              return;
            }
            if (!arbitrateScroll) return;
            const touch = e.allTouches[0];
            touchStart.value = { x: touch.absoluteX, y: touch.absoluteY };
          })
          // 잠금은 터치 도중에도 걸린다 — 자리 드래그(롱프레스 후)처럼 같은 터치
          // 안에서 페이지 콘텐츠가 전권을 가져가는 경우.
          .onTouchesMove((e, mgr) => {
            'worklet';
            if (lock?.value || (arbitrateScroll && e.allTouches.length !== 1)) {
              mgr.fail();
              return;
            }
            if (!arbitrateScroll || swiping.value) return;
            // Native scrolls and pull-to-refresh wait for this decision. Without
            // that relation, UIScrollView can cancel the pager before 24px even
            // when its content cannot actually scroll horizontally (#1150).
            const touch = e.allTouches[0];
            const translationX = touch.absoluteX - touchStart.value.x;
            const dx = Math.abs(translationX);
            const dy = Math.abs(touch.absoluteY - touchStart.value.y);
            if (dy > VERTICAL_SCROLL_SLOP && dy > dx) mgr.fail();
            else if (dx > SWIPE_CLAIM_DX) {
              const outside =
                (indexSV.value === 0 && translationX > 0) ||
                (indexSV.value === count - 1 && translationX < 0);
              // 끝에서 튕기는 페이저는 바깥 방향도 잡는다 — 놓으면 바깥 제스처가 받는데,
              // 집 탭은 탭 페이저가 잠겨 있어 아무도 안 받고 손가락만 헛돈다.
              if (outside && !bounceEdges) mgr.fail();
              else mgr.activate();
            }
          })
          .onStart(() => {
            'worklet';
            swiping.value = true;
            start.value = tx.value;
            // 정착 애니메이션 도중에 잡을 수도 있다 — 현재 위치 양옆 한 칸씩, 열린 범위는 넓히기만.
            const at = widthSV.value > 0 ? -tx.value / widthSV.value : indexSV.value;
            const lo = Math.floor(at) - 1;
            const hi = Math.ceil(at) + 1;
            const open = revealLo.value <= revealHi.value;
            revealLo.value = open ? Math.min(revealLo.value, lo) : lo;
            revealHi.value = open ? Math.max(revealHi.value, hi) : hi;
          })
          .onUpdate((e) => {
            'worklet';
            const raw = start.value + e.translationX;
            const min = -(count - 1) * widthSV.value;
            // Never reveal an empty page, including after reversing an active drag.
            // 튕기는 페이저는 끝에서 저항을 걸고 따라온다 — 놓으면 settleTarget이
            // 범위 안으로 클램프해 제자리로 돌아간다.
            tx.value = bounceEdges
              ? resistEdges(raw, min, widthSV.value)
              : Math.max(min, Math.min(0, raw));
          })
          .onEnd((e, success) => {
            'worklet';
            // RNGH also ends active gestures on cancellation/failure. Restore the
            // current page in that case, without committing a navigation change.
            const target = success
              ? settleTarget(indexSV.value, e.translationX, e.velocityX, widthSV.value, count)
              : indexSV.value;
            tx.value = withTiming(
              -target * widthSV.value,
              { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) },
              (finished) => {
                if (finished) {
                  revealLo.value = 1;
                  revealHi.value = 0;
                }
              },
            );
            if (success) runOnJS(commit)(target);
            // 끝났으면 래치도 푼다 — onFinalize가 안 오는 경로의 보험.
            swiping.value = false;
            // Only the completed animation hides neighbors. Finalizing a cancelled
            // drag (or a failed pre-activation touch) must not hide them early.
          })
          .onFinalize(() => {
            'worklet';
            swiping.value = false;
          })
      );
    },
    // count는 페이지 수(고정), 공유값·commit은 참조 안정 — 사실상 1회 생성.
    [
      arbitrateScroll,
      lock,
      bounceEdges,
      testID,
      count,
      commit,
      indexSV,
      widthSV,
      start,
      touchStart,
      swiping,
      tx,
      revealLo,
      revealHi,
    ],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <PagerGestureContext.Provider value={arbitrateScroll ? pan : undefined}>
      <GestureDetector gesture={pan}>
        <View
          style={styles.viewport}
          testID={testID}
          onLayout={(e) => {
            widthSV.value = e.nativeEvent.layout.width;
            setWidth(e.nativeEvent.layout.width);
          }}>
          <Animated.View
            testID={`${testID}-row`}
            style={[styles.row, { width: width * count || undefined }, rowStyle]}>
            {pages.map((child, i) => (
              <Page
                key={i}
                index={i}
                width={width}
                active={i === index}
                revealLo={revealLo}
                revealHi={revealHi}>
                {child}
              </Page>
            ))}
          </Animated.View>
          {overlay}
        </View>
      </GestureDetector>
    </PagerGestureContext.Provider>
  );
}

function Page({
  index,
  width,
  active,
  revealLo,
  revealHi,
  children,
}: {
  index: number;
  width: number;
  active: boolean;
  revealLo: SharedValue<number>;
  revealHi: SharedValue<number>;
  children: ReactNode;
}) {
  // 비활성 페이지는 드래그/정착 중에만 그린다 — display는 UI 스레드에서만
  // 바뀌므로 React 리렌더 없이 첫 드래그 프레임에 나타난다. 페이지는 절대
  // 배치(left = i×W)라 display:none이 이웃 페이지의 자리를 흔들지 않는다 —
  // 플렉스 행이었을 때는 숨긴 페이지가 레이아웃에서 빠지며 나머지가 앞으로
  // 밀려, 정착 후 빈 슬롯(검은 화면)이 보였다.
  const style = useAnimatedStyle(() => ({
    display: active || (index >= revealLo.value && index <= revealHi.value) ? 'flex' : 'none',
  }));
  // 페이저가 겹치면(집 탭 안의 집 페이저, #1575) 안쪽이 바깥 활성 여부를 덮어쓰면 안 된다 —
  // 다른 탭에 있는데도 집의 온라인 점·스피커가 '보이는 중'으로 돈다. 바깥과 AND한다.
  const outerActive = useContext(PageActiveContext);
  return (
    <Animated.View style={[styles.page, { left: index * width, width: width || undefined }, style]}>
      <PageActiveContext.Provider value={outerActive && active}>
        {children}
      </PageActiveContext.Provider>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  row: { flex: 1 },
  page: { position: 'absolute', top: 0, bottom: 0 },
});
