import { createRef } from 'react';
import type { ScrollView } from 'react-native';
import { renderHook } from '@testing-library/react-native';

import { useScrollRestore } from '@/hooks/use-scroll-restore';

/** scrollTo만 관찰하는 ScrollView 스텁. */
const stubRef = () => {
  const scrollTo = jest.fn();
  const ref = createRef<ScrollView>();
  (ref as { current: unknown }).current = { scrollTo };
  return { ref, scrollTo };
};

describe('useScrollRestore (#763)', () => {
  it('게터가 준 위치를 contentOffset으로 첫 페인트에 반영한다', async () => {
    const { ref } = stubRef();
    const { result } = await renderHook(() =>
      useScrollRestore(ref, { getInitialScrollY: () => 240 }),
    );
    expect(result.current.contentOffset).toEqual({ x: 0, y: 240 });
  });

  it('게터를 마운트 때 한 번만 부른다 — 리렌더마다 위치가 흔들리지 않게', async () => {
    const { ref } = stubRef();
    const getInitialScrollY = jest.fn(() => 100);
    const { rerender } = await renderHook(() => useScrollRestore(ref, { getInitialScrollY }));
    await rerender({});
    await rerender({});
    expect(getInitialScrollY).toHaveBeenCalledTimes(1);
  });

  it('콘텐츠가 목표 높이에 닿는 첫 순간 딱 한 번 복원한다 (Android 경로)', async () => {
    const { ref, scrollTo } = stubRef();
    const { result } = await renderHook(() =>
      useScrollRestore(ref, { getInitialScrollY: () => 240 }),
    );

    // 아직 짧다 — 여기서 스크롤하면 바닥에 붙어버리므로 기다린다.
    result.current.onContentSizeChange?.(400, 120);
    expect(scrollTo).not.toHaveBeenCalled();

    result.current.onContentSizeChange?.(400, 900);
    expect(scrollTo).toHaveBeenCalledWith({ y: 240, animated: false });

    // 이후 측정(이미지 지연 로드 등)에는 다시 끌어당기지 않는다.
    result.current.onContentSizeChange?.(400, 1200);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('복원할 위치가 0이면 아예 스크롤하지 않는다', async () => {
    const { ref, scrollTo } = stubRef();
    const { result } = await renderHook(() => useScrollRestore(ref, {}));
    expect(result.current.contentOffset).toEqual({ x: 0, y: 0 });
    result.current.onContentSizeChange?.(400, 900);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('스크롤 위치를 셸로 보고한다', async () => {
    const { ref } = stubRef();
    const onScrollY = jest.fn();
    const { result } = await renderHook(() => useScrollRestore(ref, { onScrollY }));
    result.current.onScroll?.({
      nativeEvent: { contentOffset: { y: 512 } },
    } as never);
    expect(onScrollY).toHaveBeenCalledWith(512);
  });
});
