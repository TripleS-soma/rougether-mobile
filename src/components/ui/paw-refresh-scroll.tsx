import { type ReactNode, type Ref, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PawPictogram } from '@/components/ui/pictograms';

/** 당김 저항 — 손가락 이동의 절반만 따라온다 (고무줄 감). */
const DAMPING = 0.5;
/** 새로고침이 걸리는 당김 깊이(저항 적용 후 px). */
const TRIGGER = 56;
/** 새로고침 동안 콘텐츠가 머무는 깊이. */
const HOLD = 52;
/** 당김 최대 깊이 — 이 이상은 끌려오지 않는다. */
const MAX_PULL = 96;

export type PawRefreshScrollProps = ScrollViewProps & {
  children?: ReactNode;
  /** 당겨서 새로고침 액션 — resolve될 때까지 발바닥이 두근거린다. */
  onRefresh?: () => Promise<unknown> | void;
  /** 내부 ScrollView ref (scrollTo 등 명령형 사용처). */
  scrollRef?: Ref<ScrollView>;
  /** pan 제스처 testID 접두사 — jest fireGestureHandler용. */
  refreshTestID?: string;
  /** 일시 잠금 — 자리 드래그처럼 다른 제스처가 화면을 점유한 동안 true. */
  refreshDisabled?: boolean;
};

/**
 * 곰 발바닥 pull-to-refresh (#454) — RN RefreshControl은 인디케이터 커스텀이
 * 불가해, RNGH 팬 + reanimated로 당김을 직접 구현한 커스텀 헤더다.
 * 스크롤이 맨 위일 때 아래로 당기면 콘텐츠가 절반 저항으로 따라 내려오고,
 * 뒤에서 발바닥이 자라난다. 임계를 넘겨 놓으면 onRefresh가 끝날 때까지
 * 발바닥이 두근거린다. iOS 바운스는 당김과 이중 동작이라 끈다.
 *
 * 팬은 스크롤 제스처와 동시 인식(simultaneous)이라 리스트 스크롤을 방해하지
 * 않는다 — 맨 위(scrollY≤0)에서 아래로 끄는 동안만 당김이 쌓인다.
 */
export function PawRefreshScroll({
  children,
  onRefresh,
  scrollRef,
  refreshTestID = 'paw-refresh',
  refreshDisabled = false,
  onScroll,
  onContentSizeChange,
  onLayout,
  contentOffset,
  ...scrollProps
}: PawRefreshScrollProps) {
  // jest의 useSharedValue는 렌더마다 새 객체 — useRef로 앵커 (#539 계약).
  const pull = useRef(useSharedValue(0)).current;
  /**
   * 캐시된 스크롤 오프셋 (#898). `onScroll`로만 갱신되는데, **오프셋이 바뀌어도
   * `onScroll`이 안 오는 구간이 둘** 있어 이 값이 실제와 어긋난다:
   *
   * 1. `contentOffset` prop으로 시작 위치를 준 경우(useScrollRestore) — 마운트
   *    시점부터 어긋난다. 그래서 초기값을 그 prop에서 받는다.
   * 2. 콘텐츠가 줄어 네이티브가 오프셋을 **조용히 클램프**한 경우(탭 전환,
   *    새로고침으로 짧아진 목록) — 실제로는 맨 위인데 캐시는 높은 값을 들고
   *    있어 당김이 전부 "중간 스크롤"로 버려졌다. 아래 두 핸들러가 같은 식으로
   *    다시 클램프한다.
   */
  const scrollY = useRef(useSharedValue(contentOffset?.y ?? 0)).current;
  /** 클램프 계산용 — 뷰포트/콘텐츠 높이. */
  const viewportH = useRef(useSharedValue(0)).current;
  const contentH = useRef(useSharedValue(0)).current;
  const baseY = useRef(useSharedValue(0)).current;
  const engaged = useRef(useSharedValue(false)).current;
  const refreshingSV = useRef(useSharedValue(false)).current;
  // 제스처를 재생성하지 않고 잠근다 — 활성 제스처 취소 사고 방지 (#333 계약).
  const disabledSV = useRef(useSharedValue(false)).current;
  useEffect(() => {
    disabledSV.value = refreshDisabled;
    if (refreshDisabled) pull.value = 0;
  }, [refreshDisabled, disabledSV, pull]);

  const finishRefresh = useCallback(() => {
    refreshingSV.value = false;
    pull.value = withTiming(0, { duration: 240 });
  }, [pull, refreshingSV]);

  const beginRefresh = useCallback(() => {
    // 발바닥 두근거림은 pawStyle이 refreshingSV로 그린다 — 끝나면 접는다.
    // 새로고침 실패는 조용히 접는다 — 에러 안내는 데이터 훅의 몫.
    try {
      void Promise.resolve(onRefresh?.())
        .catch(() => {})
        .finally(finishRefresh);
    } catch {
      finishRefresh();
    }
  }, [onRefresh, finishRefresh]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    },
    [onScroll, scrollY],
  );

  /** 네이티브가 오프셋에 거는 것과 같은 상한. */
  const clampScrollY = useCallback(() => {
    const max = Math.max(0, contentH.value - viewportH.value);
    if (scrollY.value > max) scrollY.value = max;
  }, [scrollY, contentH, viewportH]);

  // 호출부의 콜백을 삼키면 안 된다 — useScrollRestore가 onContentSizeChange로
  // 복원 스크롤을 건다 (`use-scroll-restore.ts`).
  const handleContentSizeChange = useCallback(
    (w: number, h: number) => {
      contentH.value = h;
      clampScrollY();
      onContentSizeChange?.(w, h);
    },
    [contentH, clampScrollY, onContentSizeChange],
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewportH.value = e.nativeEvent.layout.height;
      clampScrollY();
      onLayout?.(e);
    },
    [viewportH, clampScrollY, onLayout],
  );

  // ScrollView의 네이티브 제스처와 동시 인식으로 묶는다 — 팬이 스크롤을
  // 막지 않고, 맨 위에서만 당김으로 해석한다.
  const nativeScroll = useMemo(() => Gesture.Native(), []);
  const pan = useMemo(() => {
    const base = Gesture.Pan()
      .withTestId(`${refreshTestID}-pan`)
      // 세로 전용 (#454 후속) — 제약 없는 팬이 가로 스와이프까지 가로채
      // 셸 탭 페이저(#582)가 죽던 버그. 가로 우세 제스처는 즉시 실패시켜
      // 페이저·캐러셀 플링에 양보한다.
      .activeOffsetY([-12, 12])
      .failOffsetX([-12, 12])
      .onBegin(() => {
        'worklet';
        engaged.value = false;
      })
      .onUpdate((e) => {
        'worklet';
        if (refreshingSV.value || disabledSV.value || !onRefresh) return;
        if (scrollY.value > 0.5) {
          // 리스트 중간 — 당김이 아니라 스크롤. 기준점만 따라간다.
          engaged.value = false;
          baseY.value = e.translationY;
          pull.value = 0;
          return;
        }
        if (!engaged.value) {
          engaged.value = true;
          baseY.value = e.translationY;
        }
        const raw = (e.translationY - baseY.value) * DAMPING;
        pull.value = Math.max(0, Math.min(MAX_PULL, raw));
      })
      .onEnd(() => {
        'worklet';
        if (refreshingSV.value || disabledSV.value) return;
        if (pull.value >= TRIGGER) {
          refreshingSV.value = true;
          pull.value = withTiming(HOLD, { duration: 160 });
          runOnJS(beginRefresh)();
        } else {
          pull.value = withTiming(0, { duration: 200 });
        }
      });
    return base.simultaneousWithExternalGesture(nativeScroll);
  }, [
    refreshTestID,
    nativeScroll,
    engaged,
    baseY,
    pull,
    scrollY,
    refreshingSV,
    disabledSV,
    onRefresh,
    beginRefresh,
  ]);

  // 레이아웃(flex)은 정적 스타일로 — animated 스타일에 섞으면 웹에서 적용이
  // 누락돼 콘텐츠가 0 높이로 접히는 사고가 있었다 (#454 스모크).
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }));
  // 당김 진행에 따라 발바닥이 자라나고, 새로고침 중엔 두근거린다.
  const pawStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, pull.value / TRIGGER);
    return {
      opacity: refreshingSV.value ? 1 : progress,
      transform: [
        {
          scale: refreshingSV.value
            ? withRepeat(
                withSequence(
                  withTiming(1.18, { duration: 320 }),
                  withTiming(0.94, { duration: 320 }),
                ),
                -1,
                true,
              )
            : 0.4 + 0.6 * progress,
        },
        { rotate: `${-24 + 24 * progress}deg` },
      ],
    };
  });

  // 웹은 당김 없이 평범한 ScrollView — 당김은 터치 관용구고(웹은 브라우저
  // 새로고침이 있다), RNGH Native 제스처의 웹 지원 한계로 팬 인식이 깨진다.
  if (!onRefresh || Platform.OS === 'web') {
    return (
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
        contentOffset={contentOffset}
        {...scrollProps}>
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.indicatorArea} pointerEvents="none">
        <Animated.View style={pawStyle} testID={`${refreshTestID}-paw`}>
          <PawPictogram size={30} />
        </Animated.View>
      </View>
      {/* translateY 래퍼는 제스처 대상이 아니다 — 팬·네이티브 스크롤 제스처는
          RNGH 문서의 정석대로 ScrollView 자체에 함께 붙인다. */}
      <Animated.View style={[styles.content, contentStyle]}>
        <GestureDetector gesture={Gesture.Simultaneous(pan, nativeScroll)}>
          <ScrollView
            ref={scrollRef}
            onScroll={handleScroll}
            onContentSizeChange={handleContentSizeChange}
            onLayout={handleLayout}
            contentOffset={contentOffset}
            scrollEventThrottle={16}
            // iOS 바운스는 커스텀 당김과 이중 동작 — 당김 헤더가 대신한다.
            bounces={false}
            {...scrollProps}>
            {children}
          </ScrollView>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  indicatorArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MAX_PULL,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
