import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useRoomInstrumentSounds } from '../use-room-instrument-sounds';
import { createInstrumentPlayer } from '@/lib/instrument-player';
import { INSTRUMENT_SOUNDS } from '@/resources/instrument-sounds';

jest.mock('@/lib/instrument-player', () => ({ createInstrumentPlayer: jest.fn() }));
const factory = jest.mocked(createInstrumentPlayer);
const guitar = INSTRUMENT_SOUNDS[0].assetKey;
let instances: { replay: jest.Mock; dispose: jest.Mock; fail: () => void }[];
let changeState: (state: AppStateStatus) => void;
let remove: jest.Mock;
let now: number;
beforeEach(() => {
  instances = [];
  now = 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    changeState = listener;
    return { remove };
  });
  factory.mockImplementation((_source, fail) => {
    const player = { replay: jest.fn().mockResolvedValue(undefined), dispose: jest.fn(), fail };
    instances.push(player);
    return player;
  });
});
afterEach(() => jest.restoreAllMocks());

it('등록된 악기만 터치로 재생하고 140ms 중복 터치를 무시하며 플레이어를 재사용한다', async () => {
  const { result } = await renderHook(() => useRoomInstrumentSounds());
  expect(factory).not.toHaveBeenCalled();
  await act(() => result.current.play('items/unknown.png'));
  expect(factory).not.toHaveBeenCalled();
  await act(() => result.current.play(guitar));
  await act(() => result.current.play(guitar));
  expect(instances[0].replay).toHaveBeenCalledTimes(1);
  now += 140;
  await act(() => result.current.play(guitar));
  expect(instances[0].replay).toHaveBeenCalledTimes(2);
  for (const sound of INSTRUMENT_SOUNDS.slice(1))
    await act(() => result.current.play(sound.assetKey));
  expect(instances).toHaveLength(4);
});

it('효과음 설정 또는 화면 활성화가 꺼지면 정지하고 재활성화만으로 재생하지 않는다', async () => {
  const { result, rerender, unmount } = await renderHook(
    ({ enabled }: { enabled: boolean }) => useRoomInstrumentSounds(enabled),
    { initialProps: { enabled: false } },
  );
  await act(() => result.current.play(guitar));
  expect(factory).not.toHaveBeenCalled();
  await rerender({ enabled: true });
  const callback = result.current.play;
  await act(() => result.current.play(guitar));
  await rerender({ enabled: false });
  expect(instances[0].dispose).toHaveBeenCalledTimes(1);
  await act(() => instances[0].fail());
  expect(result.current.error).toBeNull();
  await rerender({ enabled: true });
  expect(result.current.play).toBe(callback);
  expect(instances).toHaveLength(1);
  await act(() => result.current.play(guitar));
  await unmount();
  expect(instances[1].dispose).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalled();
  await act(() => callback(guitar));
  expect(instances).toHaveLength(2);
});

it('백그라운드에서는 멈추며 복귀 후 새로운 터치에만 반응한다', async () => {
  const { result } = await renderHook(() => useRoomInstrumentSounds());
  await act(() => result.current.play(guitar));
  await act(() => changeState('inactive'));
  expect(instances[0].dispose).toHaveBeenCalledTimes(1);
  await act(() => result.current.play(guitar));
  expect(instances).toHaveLength(1);
  await act(() => changeState('active'));
  expect(instances).toHaveLength(1);
  await act(() => result.current.play(guitar));
  expect(instances).toHaveLength(2);
});

it('실패한 플레이어를 제거하고 다음 터치에서 복구하며 과거 오류는 무시한다', async () => {
  const { result } = await renderHook(() => useRoomInstrumentSounds());
  await act(() => result.current.play(guitar));
  await act(() => instances[0].fail());
  expect(result.current.error).toBeTruthy();
  expect(instances[0].dispose).toHaveBeenCalledTimes(1);
  await act(() => result.current.play(guitar));
  expect(instances).toHaveLength(2);
  expect(result.current.error).toBeNull();
  await act(() => instances[0].fail());
  expect(result.current.error).toBeNull();
  instances[1].replay.mockRejectedValueOnce(new Error('audio'));
  now += 140;
  await act(() => result.current.play(guitar));
  expect(result.current.error).toBeTruthy();
  expect(instances[1].dispose).toHaveBeenCalledTimes(1);
});
