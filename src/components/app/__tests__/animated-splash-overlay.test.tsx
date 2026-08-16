import { act, render } from '@testing-library/react-native';

import { AnimatedSplashOverlay } from '@/components/app/animated-splash-overlay';
import { markAppReady, resetAppReadyForTest } from '@/lib/app-ready';

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
    // 모듈 스토어라 테스트 간에 준비 상태가 샌다 (#847).
    resetAppReadyForTest();
  });

  /** 앱이 그릴 준비를 마쳤다고 알린다 — 이게 없으면 상한까지 안 걷힌다. */
  const ready = async () => {
    await act(async () => {
      markAppReady();
    });
  };
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
    await ready();
    await act(async () => {
      jest.advanceTimersByTime(1300);
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('최소 노출 시간이 지나면 hideAsync를 부르고 페이드로 전환한다', async () => {
    await render(<AnimatedSplashOverlay />);
    await ready();
    await act(async () => {
      jest.advanceTimersByTime(1300);
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('페이드 완료 콜백이 유실돼도 안전망 타이머로 오버레이가 사라진다 (#579)', async () => {
    const { queryByTestId, toJSON } = await render(<AnimatedSplashOverlay />);
    void queryByTestId;
    await ready();
    await act(async () => {
      jest.advanceTimersByTime(1300); // holding → fading
    });
    expect(toJSON()).not.toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(1100); // DURATION(600)+400 안전망 경과
    });
    expect(toJSON()).toBeNull(); // 오버레이 제거 — 단색 화면에 갇히지 않는다
  });

  /**
   * #847 — 예전엔 최소 노출 시간만 지나면 걷혔다. AppRoot의 두 관문(세션
   * 복원 → 온보딩 플래그)이 직렬 AsyncStorage 읽기라 느린 기기에서 그보다
   * 오래 걸리면, 오버레이가 먼저 걷혀 빈 화면이 드러났다.
   */
  it('준비 신호가 없으면 최소 노출이 지나도 걷지 않는다 (#847)', async () => {
    await render(<AnimatedSplashOverlay />);
    await act(async () => {
      jest.advanceTimersByTime(2000); // 최소 노출(1200)을 한참 넘김
    });
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('준비가 늦게 와도 그때 걷는다 (#847)', async () => {
    await render(<AnimatedSplashOverlay />);
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();

    await ready();
    await act(async () => {
      jest.advanceTimersByTime(10); // 최소 노출은 이미 지나 대기 0
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  /** 준비가 영영 안 와도 스플래시에 갇히면 안 된다 — AppRoot가 로딩을 그린다. */
  it('상한을 넘으면 준비 없이도 걷는다 (#847)', async () => {
    await render(<AnimatedSplashOverlay />);
    await act(async () => {
      jest.advanceTimersByTime(4100); // MAX_SPLASH_MS(4000) 경과
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });
});
