import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { PointerType, State } from 'react-native-gesture-handler';

import type { Screen } from '@/components/app/navigation';
import { useAppNavigation } from '@/components/app/use-app-navigation';

const originalOS = Platform.OS;

afterEach(() => {
  Platform.OS = originalOS;
});

async function renderNavigation(screen: Screen) {
  const setScreen = jest.fn();
  const hook = await renderHook(
    ({ screen }: { screen: Screen }) =>
      useAppNavigation({ screen, setScreen, addReturnScreen: 'myRoom', noHouses: false }),
    { initialProps: { screen } },
  );
  return { ...hook, setScreen };
}

// Exercise JS navigation eligibility only; native recognition is checked by
// the enabled assertions below, not simulated by these callback events.
function swipeBack(gesture: ReturnType<typeof useAppNavigation>['edgeBackPan'], x: number) {
  const touch = { id: 0, x, y: 100, absoluteX: x, absoluteY: 100 };
  gesture.handlers.onTouchesDown?.(
    {
      handlerTag: gesture.handlerTag,
      numberOfTouches: 1,
      state: State.BEGAN,
      eventType: 1, // TOUCHES_DOWN
      allTouches: [touch],
      changedTouches: [touch],
      pointerType: PointerType.TOUCH,
    },
    {
      handlerTag: gesture.handlerTag,
      begin: jest.fn(),
      activate: jest.fn(),
      fail: jest.fn(),
      end: jest.fn(),
    },
  );
  const end = {
    ...touch,
    handlerTag: gesture.handlerTag,
    numberOfPointers: 1,
    pointerType: PointerType.TOUCH,
    state: State.END,
    oldState: State.ACTIVE,
    translationX: 100,
    translationY: 0,
    velocityX: 800,
    velocityY: 0,
  };
  gesture.handlers.onEnd?.(end, true);
  gesture.handlers.onFinalize?.(end, true);
}

describe('main-tab edge-back recognition', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  it.each<Screen>(['myRoom', 'house', 'myPage'])(
    'disables the native recognizer on %s, before it can compete with the pager',
    async (screen) => {
      const { result } = await renderNavigation(screen);
      expect(result.current.edgeBackPan.config.enabled).toBe(false);
    },
  );

  it.each<{ tab: Screen; detail: Screen }>([
    { tab: 'myRoom', detail: 'decor' },
    { tab: 'house', detail: 'houseMembers' },
    { tab: 'myPage', detail: 'settings' },
  ])('enables back on $detail and disables it again on $tab', async ({ tab, detail }) => {
    const { result, rerender } = await renderNavigation(tab);
    await rerender({ screen: detail });
    expect(result.current.edgeBackPan.config.enabled).toBe(true);

    await rerender({ screen: tab });
    expect(result.current.edgeBackPan.config.enabled).toBe(false);
  });

  it('keeps the active gesture stable during unrelated renders and sub-screen navigation', async () => {
    const { result, rerender } = await renderNavigation('settings');
    const gesture = result.current.edgeBackPan;
    await rerender({ screen: 'settings' });
    expect(result.current.edgeBackPan).toBe(gesture);
    await rerender({ screen: 'theme' });
    expect(result.current.edgeBackPan).toBe(gesture);
    expect(result.current.edgeBackPan.config.enabled).toBe(true);
  });

  it.each<{ screen: Screen; back: Screen }>([
    { screen: 'friendRoom', back: 'house' },
    { screen: 'decor', back: 'myRoom' },
    { screen: 'gacha', back: 'myRoom' },
    { screen: 'addRoutine', back: 'myRoom' },
  ])(
    'preserves full-width back and the edge-only exception for $screen',
    async ({ screen, back }) => {
      const { result, rerender, setScreen } = await renderNavigation('settings');
      const gesture = result.current.edgeBackPan;
      swipeBack(gesture, 200);
      expect(setScreen).toHaveBeenCalledWith('myPage');

      setScreen.mockClear();
      await rerender({ screen });
      expect(result.current.edgeBackPan).toBe(gesture);
      swipeBack(result.current.edgeBackPan, 200);
      expect(setScreen).not.toHaveBeenCalled();
      swipeBack(result.current.edgeBackPan, 10);
      expect(setScreen).toHaveBeenCalledWith(back);

      setScreen.mockClear();
      await rerender({ screen: 'settings' });
      swipeBack(result.current.edgeBackPan, 200);
      expect(setScreen).toHaveBeenCalledWith('myPage');
    },
  );

  it.each(['android', 'web'] as const)('keeps edge-back disabled on %s', async (platform) => {
    Platform.OS = platform;
    const { result, rerender } = await renderNavigation('myPage');
    expect(result.current.edgeBackPan.config.enabled).toBe(false);
    await rerender({ screen: 'settings' });
    expect(result.current.edgeBackPan.config.enabled).toBe(false);
  });
});
