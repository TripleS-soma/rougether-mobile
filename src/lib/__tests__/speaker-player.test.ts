import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { SpeakerPlayerFactory } from '@/lib/speaker-player.types';
// Explicit base file: Jest Expo defaults to iOS, while this adapter serves Android.
const { createSpeakerPlayer } = jest.requireActual<{ createSpeakerPlayer: SpeakerPlayerFactory }>(
  '../speaker-player.ts',
);
it('does not start after disposal while audio session setup is pending', async () => {
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
it('uses native looping and lock screen controls, reflects remote pause and clears the session on disposal', async () => {
  const emit = jest.fn();
  const controller = createSpeakerPlayer(1, 0.6, emit, jest.fn(), '모닥불');
  const native = jest.mocked(createAudioPlayer).mock.results[0].value;
  await controller.play();
  expect(native.loop).toBe(true);
  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ shouldPlayInBackground: true }),
  );
  expect(native.setActiveForLockScreen).toHaveBeenCalledWith(
    true,
    { title: '모닥불', artist: '루게더' },
    expect.any(Object),
  );
  native.addListener.mock.calls[0][1]({ playing: false, isBuffering: false });
  expect(emit).toHaveBeenLastCalledWith(false);
  controller.dispose();
  expect(native.setActiveForLockScreen).toHaveBeenLastCalledWith(false);
  expect(native.remove).toHaveBeenCalled();
});
