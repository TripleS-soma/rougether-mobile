import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { createInstrumentPlayer } from '../instrument-player';

it('처음부터 짧게 재생하고 스피커의 오디오 모드와 잠금화면을 건드리지 않는다', async () => {
  const controller = createInstrumentPlayer(1, jest.fn());
  const native = jest.mocked(createAudioPlayer).mock.results[0].value;
  await controller.replay();
  expect(createAudioPlayer).toHaveBeenCalledWith(1, { keepAudioSessionActive: true });
  expect(native.loop).toBe(false);
  expect(native.volume).toBe(0.55);
  expect(native.seekTo).toHaveBeenCalledWith(0);
  expect(native.play).toHaveBeenCalledTimes(1);
  controller.dispose();
  controller.dispose();
  expect(native.remove).toHaveBeenCalledTimes(1);
  expect(setAudioModeAsync).not.toHaveBeenCalled();
  expect(native.setActiveForLockScreen).not.toHaveBeenCalled();
});

it('늦게 완료된 탐색은 새 터치나 정지 뒤에 재생을 시작하지 않는다', async () => {
  const controller = createInstrumentPlayer(1, jest.fn());
  const native = jest.mocked(createAudioPlayer).mock.results[0].value;
  let resolve!: () => void;
  native.seekTo.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const first = controller.replay();
  await controller.replay();
  resolve();
  await first;
  expect(native.play).toHaveBeenCalledTimes(1);
  native.seekTo.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const pending = controller.replay();
  controller.dispose();
  resolve();
  await pending;
  expect(native.play).toHaveBeenCalledTimes(1);
});

it('재생 실패를 전달하지만 제거 후 상태 이벤트를 무시한다', async () => {
  const fail = jest.fn();
  const controller = createInstrumentPlayer(1, fail);
  const native = jest.mocked(createAudioPlayer).mock.results[0].value;
  native.seekTo.mockRejectedValueOnce(new Error('decode'));
  await expect(controller.replay()).rejects.toThrow('decode');
  const emit = native.addListener.mock.calls[0][1];
  emit({ playbackState: 'error' });
  expect(fail).toHaveBeenCalledTimes(1);
  controller.dispose();
  emit({ playbackState: 'error' });
  expect(fail).toHaveBeenCalledTimes(1);
});
