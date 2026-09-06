import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import type { Screen } from '@/components/app/navigation';
import { useAppNavigation } from '@/components/app/use-app-navigation';

const originalOS = Platform.OS;

afterEach(() => {
  Platform.OS = originalOS;
});

async function renderNavigation(screen: Screen) {
  const setScreen = jest.fn();
  return renderHook(
    ({ screen }: { screen: Screen }) =>
      useAppNavigation({ screen, setScreen, addReturnScreen: 'myRoom', noHouses: false }),
    { initialProps: { screen } },
  );
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

  it.each(['android', 'web'] as const)('keeps edge-back disabled on %s', async (platform) => {
    Platform.OS = platform;
    const { result, rerender } = await renderNavigation('myPage');
    expect(result.current.edgeBackPan.config.enabled).toBe(false);
    await rerender({ screen: 'settings' });
    expect(result.current.edgeBackPan.config.enabled).toBe(false);
  });
});
