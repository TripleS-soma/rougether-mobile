import { renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';

import {
  useAnimatedValue,
  useAnimatedValueXY,
  useConstant,
  useLatestRef,
  useStableCallback,
} from '@/hooks/use-stable-value';

// #748 — 관용구를 훅에 가둬도 참조 안정성은 인라인 판과 같아야 한다(#539 렌더 안정성 계약).
describe('useAnimatedValue / useAnimatedValueXY', () => {
  it('첫 렌더의 인스턴스를 유지하고, 이후 initial 변화는 무시한다', async () => {
    const { result, rerender } = await renderHook(
      ({ v }: { v: number }) => ({
        value: useAnimatedValue(v),
        xy: useAnimatedValueXY({ x: v, y: v }),
      }),
      { initialProps: { v: 1 } },
    );
    const first = result.current;
    expect(first.value).toBeInstanceOf(Animated.Value);
    expect(first.xy).toBeInstanceOf(Animated.ValueXY);

    await rerender({ v: 2 });
    expect(result.current.value).toBe(first.value);
    expect(result.current.xy).toBe(first.xy);
  });
});

describe('useConstant', () => {
  it('factory를 첫 렌더에 한 번만 호출하고 같은 값을 돌려준다', async () => {
    const factory = jest.fn(() => ({ id: Math.random() }));
    const { result, rerender } = await renderHook(() => useConstant(factory));
    const first = result.current;

    await rerender({});
    await rerender({});
    expect(result.current).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('useLatestRef', () => {
  it('ref 객체는 고정, current는 매 렌더 최신 값', async () => {
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useLatestRef(v), {
      initialProps: { v: 'a' },
    });
    const ref = result.current;
    expect(ref.current).toBe('a');

    await rerender({ v: 'b' });
    expect(result.current).toBe(ref);
    expect(ref.current).toBe('b');
  });
});

describe('useStableCallback', () => {
  it('참조는 영구히 고정되고, 호출은 최신 클로저로 위임된다', async () => {
    const { result, rerender } = await renderHook(
      ({ n }: { n: number }) => useStableCallback((x: number) => x + n),
      { initialProps: { n: 1 } },
    );
    const cb = result.current;
    expect(cb(10)).toBe(11);

    await rerender({ n: 5 });
    expect(result.current).toBe(cb);
    // 첫 렌더에 잡아 둔 cb로 불러도 낡은 n(1)이 아니라 최신 n(5)을 읽는다.
    expect(cb(10)).toBe(15);
  });
});
