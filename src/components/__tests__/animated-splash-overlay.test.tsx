import { act, render } from '@testing-library/react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(async () => {}),
  preventAutoHideAsync: jest.fn(async () => {}),
  setOptions: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SplashScreen = require('expo-splash-screen') as { hideAsync: jest.Mock };

describe('AnimatedSplashOverlay (#569)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    SplashScreen.hideAsync.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('최소 노출 시간이 지나기 전에는 네이티브 스플래시를 걷지 않는다', async () => {
    await render(<AnimatedSplashOverlay />);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('hideAsync가 실패해도 전환이 계속된다 (catch 경로)', async () => {
    SplashScreen.hideAsync.mockRejectedValueOnce(new Error('already hidden'));
    await render(<AnimatedSplashOverlay />);
    await act(async () => {
      jest.advanceTimersByTime(1300);
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('최소 노출 시간이 지나면 hideAsync를 부르고 페이드로 전환한다', async () => {
    await render(<AnimatedSplashOverlay />);
    await act(async () => {
      jest.advanceTimersByTime(1300);
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });
});
