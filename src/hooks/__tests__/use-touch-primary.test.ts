/**
 * 터치가 주 입력인가 — 네이티브는 항상 true, 웹은 `(pointer: coarse)`. 앱 프레임이 이 값으로
 * 넓은 창의 2단 기준(터치 640 / 마우스 960)을 가른다.
 */
import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useTouchPrimary } from '@/hooks/use-touch-primary';

type Listener = () => void;

/** `window.matchMedia`를 심는다 — matches를 바꾸고 change를 쏠 수 있는 손잡이를 돌려준다. */
function installMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mq = {
    matches: initial,
    addEventListener: (_: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
  };
  const matchMedia = jest.fn(() => mq);
  Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true });
  return {
    matchMedia,
    listeners,
    set(next: boolean) {
      mq.matches = next;
      listeners.forEach((fn) => fn());
    },
  };
}

describe('useTouchPrimary', () => {
  let os: ReturnType<typeof jest.replaceProperty>;
  afterEach(() => {
    os?.restore();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('네이티브는 항상 true — matchMedia가 없어도', async () => {
    const { result } = await renderHook(() => useTouchPrimary());
    expect(result.current).toBe(true);
  });

  it('웹에서 matchMedia가 없으면 false(마우스로 본다)', async () => {
    os = jest.replaceProperty(Platform, 'OS', 'web');
    const { result } = await renderHook(() => useTouchPrimary());
    expect(result.current).toBe(false);
  });

  it('웹은 (pointer: coarse)를 읽는다', async () => {
    os = jest.replaceProperty(Platform, 'OS', 'web');
    const media = installMatchMedia(true);
    const { result } = await renderHook(() => useTouchPrimary());
    expect(result.current).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith('(pointer: coarse)');
  });

  it('주 입력이 바뀌면(change) 따라가고, 언마운트하면 구독을 푼다', async () => {
    os = jest.replaceProperty(Platform, 'OS', 'web');
    const media = installMatchMedia(false);
    const { result, unmount } = await renderHook(() => useTouchPrimary());
    expect(result.current).toBe(false);
    await act(async () => media.set(true));
    expect(result.current).toBe(true);
    await unmount();
    expect(media.listeners.size).toBe(0);
  });
});
