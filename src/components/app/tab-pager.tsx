import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { SWIPE_CLAIM_DX, SWIPE_FAIL_DY } from '@/utils/gesture';

/** 페이지 스냅 판정 — 폭 대비 이 비율을 넘게 끌면 넘어간다. */
export const PAGE_SNAP_RATIO = 0.3;
/** 스냅 속도 임계(px/s) — 짧게 끌어도 이 속도면 플링으로 인정. */
export const PAGE_FLING_VELOCITY = 500;
/** 페이지 정착 애니메이션 길이(ms) — 셸 화면 전환(340ms)과 같은 결. */
const SETTLE_MS = 260;
/** 끝 페이지 밖으로 끌 때의 저항 배율. */
const EDGE_RESISTANCE = 0.25;
/** Release vertical scrolls promptly instead of waiting for the 24px page claim. */
const VERTICAL_SCROLL_SLOP = 12;

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
export function TabPager({ index, onIndexChange, lock, children }: TabPagerProps) {
  const arbitrateScroll = Platform.OS === 'ios';
  const count = children.length;
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
  const revealAll = useRef(useSharedValue(false)).current;
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
    const widthChanged = prevWidthRef.current !== width;
    prevWidthRef.current = width;
    if (settledRef.current === index) {
      if (widthChanged) tx.value = -index * width;
      return;
    }
    settledRef.current = index;
    revealAll.value = true;
    tx.value = withTiming(
      -index * width,
      { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) revealAll.value = false;
      },
    );
  }, [index, width, tx, revealAll]);

  commitRef.current = (target: number) => {
    settledRef.current = target;
    if (target !== index) onIndexChange(target);
  };
  const commit = useCallback((target: number) => commitRef.current(target), []);

  const pan = useMemo(
    () => {
      const gesture = Gesture.Pan().withTestId('tab-pager-pan').maxPointers(1);
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
            const dx = Math.abs(touch.absoluteX - touchStart.value.x);
            const dy = Math.abs(touch.absoluteY - touchStart.value.y);
            if (dy > VERTICAL_SCROLL_SLOP && dy > dx) mgr.fail();
            else if (dx > SWIPE_CLAIM_DX) mgr.activate();
          })
          .onStart(() => {
            'worklet';
            swiping.value = true;
            start.value = tx.value;
            revealAll.value = true;
          })
          .onUpdate((e) => {
            'worklet';
            const raw = start.value + e.translationX;
            const min = -(count - 1) * widthSV.value;
            // 끝 페이지 밖은 저항을 걸어 살짝만 끌린다.
            tx.value =
              raw > 0
                ? raw * EDGE_RESISTANCE
                : raw < min
                  ? min + (raw - min) * EDGE_RESISTANCE
                  : raw;
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
                if (finished) revealAll.value = false;
              },
            );
            if (success) runOnJS(commit)(target);
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
      count,
      commit,
      indexSV,
      widthSV,
      start,
      touchStart,
      swiping,
      tx,
      revealAll,
    ],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <PagerGestureContext.Provider value={arbitrateScroll ? pan : undefined}>
      <GestureDetector gesture={pan}>
        <View
          style={styles.viewport}
          testID="tab-pager"
          onLayout={(e) => {
            widthSV.value = e.nativeEvent.layout.width;
            setWidth(e.nativeEvent.layout.width);
          }}>
          <Animated.View style={[styles.row, { width: width * count || undefined }, rowStyle]}>
            {children.map((child, i) => (
              <Page key={i} index={i} width={width} active={i === index} revealAll={revealAll}>
                {child}
              </Page>
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
    </PagerGestureContext.Provider>
  );
}

function Page({
  index,
  width,
  active,
  revealAll,
  children,
}: {
  index: number;
  width: number;
  active: boolean;
  revealAll: SharedValue<boolean>;
  children: ReactNode;
}) {
  // 비활성 페이지는 드래그/정착 중에만 그린다 — display는 UI 스레드에서만
  // 바뀌므로 React 리렌더 없이 첫 드래그 프레임에 나타난다. 페이지는 절대
  // 배치(left = i×W)라 display:none이 이웃 페이지의 자리를 흔들지 않는다 —
  // 플렉스 행이었을 때는 숨긴 페이지가 레이아웃에서 빠지며 나머지가 앞으로
  // 밀려, 정착 후 빈 슬롯(검은 화면)이 보였다.
  const style = useAnimatedStyle(() => ({
    display: active || revealAll.value ? 'flex' : 'none',
  }));
  return (
    <Animated.View style={[styles.page, { left: index * width, width: width || undefined }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  row: { flex: 1 },
  page: { position: 'absolute', top: 0, bottom: 0 },
});
