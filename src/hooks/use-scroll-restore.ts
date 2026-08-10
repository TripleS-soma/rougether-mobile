import { useCallback, useRef, type RefObject } from 'react';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
} from 'react-native';

import { useConstant } from '@/hooks/use-stable-value';

/** 스크롤 위치 보존을 켜는 prop 쌍 (#763) — 탭 화면 3종이 공유하는 계약. */
export type ScrollRestoreProps = {
  /**
   * 마운트 시점의 복원 위치를 돌려주는 게터. **값이 아니라 함수**인 이유:
   * 값으로 내리면 스크롤할 때마다 prop이 바뀌어 memo 화면(#539)이 매번
   * 리렌더된다. 게터는 참조가 고정이고 마운트 때 한 번만 호출된다.
   */
  getInitialScrollY?: () => number;
  /** 스크롤 위치 보고 — 셸이 탭별로 기억한다. 참조 고정 필수. */
  onScrollY?: (y: number) => void;
};

type RestoredProps = Pick<
  ScrollViewProps,
  'contentOffset' | 'onContentSizeChange' | 'onScroll' | 'scrollEventThrottle'
>;

/**
 * 서브화면에 다녀와도 스크롤 위치를 되찾는다 (#763). 서브화면으로 가면
 * `activeTab`이 null이 되어 탭 페이저가 통째로 언마운트되므로(app-shell),
 * 위치는 항상 마운트된 셸이 기억하고 이 훅이 복원한다.
 *
 * 복원을 두 갈래로 거는 이유: `contentOffset`은 iOS에서 첫 페인트부터 그
 * 위치로 그려 줘 깜빡임이 없지만 Android에선 동작하지 않는다. 그래서
 * 콘텐츠 높이가 목표에 닿는 첫 순간 `scrollTo`로 한 번 더 맞춘다 — iOS에선
 * 이미 그 위치라 무해한 no-op이다.
 */
export function useScrollRestore(
  scrollRef: RefObject<ScrollView | null>,
  { getInitialScrollY, onScrollY }: ScrollRestoreProps,
): RestoredProps {
  const initialY = useConstant(() => Math.max(0, getInitialScrollY?.() ?? 0));
  // 0이면 복원할 게 없다 — 첫 콘텐츠 측정에서 곧바로 끝난 것으로 친다.
  const restored = useRef(initialY === 0);

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      // 콘텐츠가 아직 목표 높이에 못 미치면(이미지·리스트 지연 로드) 다음
      // 측정을 기다린다 — 여기서 스크롤하면 바닥에 붙어버린다.
      if (restored.current || h < initialY) return;
      restored.current = true;
      scrollRef.current?.scrollTo({ y: initialY, animated: false });
    },
    [initialY, scrollRef],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => onScrollY?.(e.nativeEvent.contentOffset.y),
    [onScrollY],
  );

  return {
    contentOffset: { x: 0, y: initialY },
    onContentSizeChange,
    onScroll,
    scrollEventThrottle: 16,
  };
}
