import { AppState } from 'react-native';
import { createSpeakerPlayer } from '@/lib/speaker-player.ios';
const mockNative = {
  prepare: jest.fn().mockResolvedValue(undefined),
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  dispose: jest.fn().mockResolvedValue(undefined),
  refresh: jest.fn().mockResolvedValue(undefined),
  setVolume: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};
const mockDownload = jest.fn();
jest.mock('expo-modules-core', () => ({ requireNativeModule: () => mockNative }));
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ downloadAsync: mockDownload }) } }));
beforeEach(() => mockDownload.mockResolvedValue({ localUri: 'file:///rain-loop.wav' }));
it('prepares a local native loop and reflects lock screen pause/play for the matching session only', async () => {
  const emit = jest.fn();
  const controller = createSpeakerPlayer(1, 0.4, emit, jest.fn(), '빗소리');
  await controller.play();
  const id = mockNative.prepare.mock.calls[0][0];
  expect(mockNative.prepare).toHaveBeenCalledWith(
    id,
    'file:///rain-loop.wav',
    0.4,
    '빗소리',
    '루게더',
  );
  expect(mockNative.play).toHaveBeenCalledWith(id);
  const notify = (
    mockNative.addListener.mock.calls as unknown as [string, (v: unknown) => void][]
  )[0][1];
  notify({ id, playing: true, error: false });
  notify({ id: 'stale-session', playing: false, error: false });
  expect(emit).toHaveBeenLastCalledWith(true);
  notify({ id, playing: false, error: false });
  expect(emit).toHaveBeenLastCalledWith(false);
  controller.dispose();
  expect(mockNative.dispose).toHaveBeenCalledWith(id);
});
it('does not prepare or start a downloaded asset after the user stops', async () => {
  let resolve!: (value: unknown) => void;
  mockDownload.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const controller = createSpeakerPlayer(1, 0.4, jest.fn(), jest.fn());
  const pending = controller.play();
  controller.dispose();
  resolve({ localUri: 'file:///rain-loop.wav' });
  await pending;
  expect(mockNative.prepare).not.toHaveBeenCalled();
  expect(mockNative.play).not.toHaveBeenCalled();
});
it('does not stop when the app locks and refreshes remote state upon return', async () => {
  const spy = jest.spyOn(AppState, 'addEventListener');
  const controller = createSpeakerPlayer(1, 0.4, jest.fn(), jest.fn());
  await controller.play();
  const listener = spy.mock.calls[0][1];
  listener('background');
  expect(mockNative.pause).not.toHaveBeenCalled();
  expect(mockNative.dispose).not.toHaveBeenCalled();
  listener('active');
  expect(mockNative.refresh).toHaveBeenCalledTimes(1);
  controller.dispose();
  spy.mockRestore();
});
