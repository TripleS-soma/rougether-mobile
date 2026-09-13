import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { createSpeakerPlayer } from '@/lib/speaker-player';
it('오디오 모드 설정을 기다리는 사이 정지되면 재생을 시작하지 않는다', async () => {
  let resolve!: () => void;
  jest.mocked(setAudioModeAsync).mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const controller = createSpeakerPlayer(1, 0.35, jest.fn(), jest.fn());
  const pending = controller.play();
  controller.dispose();
  resolve();
  await pending;
  const native = jest.mocked(createAudioPlayer).mock.results[0].value;
  expect(native.play).not.toHaveBeenCalled();
  expect(native.remove).toHaveBeenCalled();
});

it('끝나기 전에 다음 플레이어를 켜고 두 볼륨을 교차한 뒤 이전 것을 되감는다', async () => {
  jest.useFakeTimers();
  jest.mocked(createAudioPlayer).mockClear();
  try {
    const emit = jest.fn();
    const controller = createSpeakerPlayer(1, 0.6, emit, jest.fn());
    const [first, second] = jest
      .mocked(createAudioPlayer)
      .mock.results.map((result) => result.value);
    const updateFirst = first.addListener.mock.calls[0][1];
    const updateSecond = second.addListener.mock.calls[0][1];
    await controller.play();
    updateSecond({ isLoaded: true, playing: false, currentTime: 0, duration: 30 });
    updateFirst({ isLoaded: true, playing: true, currentTime: 28, duration: 30 });
    expect(second.play).toHaveBeenCalledTimes(1);
    updateSecond({ isLoaded: true, playing: true, currentTime: 1, duration: 30 });
    jest.advanceTimersByTime(50);
    expect(first.volume).toBeCloseTo(0.3);
    expect(second.volume).toBeCloseTo(0.3);
    updateSecond({ isLoaded: true, playing: true, currentTime: 2, duration: 30 });
    jest.advanceTimersByTime(50);
    expect(first.pause).toHaveBeenCalled();
    expect(first.seekTo).toHaveBeenCalledWith(0);
    expect(second.volume).toBeCloseTo(0.6);
    controller.dispose();
    expect(first.remove).toHaveBeenCalled();
    expect(second.remove).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});
