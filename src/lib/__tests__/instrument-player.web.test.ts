import type { InstrumentPlayerFactory } from '../instrument-player.types';
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ uri: '/instrument.wav' }) } }));
const { createInstrumentPlayer } = jest.requireActual<{
  createInstrumentPlayer: InstrumentPlayerFactory;
}>('../instrument-player.web');
let instances: FakeAudio[];
class FakeAudio {
  preload = '';
  volume = 1;
  loop = true;
  currentTime = 10;
  play = jest.fn().mockResolvedValue(undefined);
  pause = jest.fn();
  load = jest.fn();
  removeAttribute = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  constructor(public src: string) {
    instances.push(this);
  }
}
const original = globalThis.Audio;
beforeEach(() => {
  instances = [];
  globalThis.Audio = FakeAudio as unknown as typeof Audio;
});
afterEach(() => {
  globalThis.Audio = original;
});

it('웹 사용자 제스처 안에서 즉시 play하고 소리를 처음부터 재생한다', async () => {
  const controller = createInstrumentPlayer(1, jest.fn());
  const pending = controller.replay();
  expect(instances[0].play).toHaveBeenCalledTimes(1);
  expect(instances[0]).toMatchObject({
    src: '/instrument.wav',
    currentTime: 0,
    loop: false,
    volume: 0.55,
  });
  await pending;
  controller.dispose();
  controller.dispose();
  expect(instances[0].removeAttribute).toHaveBeenCalledWith('src');
  expect(instances[0].load).toHaveBeenCalledTimes(1);
});

it('자동재생 거부를 전달하고 새 터치·정지로 취소된 과거 play 오류는 무시한다', async () => {
  const controller = createInstrumentPlayer(1, jest.fn());
  instances[0].play.mockRejectedValueOnce(new Error('NotAllowedError'));
  await expect(controller.replay()).rejects.toThrow('NotAllowedError');
  let reject!: (error: Error) => void;
  instances[0].play.mockImplementationOnce(
    () =>
      new Promise<void>((_, r) => {
        reject = r;
      }),
  );
  const old = controller.replay();
  await controller.replay();
  reject(new Error('AbortError'));
  await expect(old).resolves.toBeUndefined();
  instances[0].play.mockImplementationOnce(
    () =>
      new Promise<void>((_, r) => {
        reject = r;
      }),
  );
  const pending = controller.replay();
  controller.dispose();
  reject(new Error('AbortError'));
  await expect(pending).resolves.toBeUndefined();
});
