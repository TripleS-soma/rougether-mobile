import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { useRoomSpeaker } from '@/hooks/use-room-speaker';
import { createSpeakerPlayer } from '@/lib/speaker-player';
jest.mock('@/lib/speaker-player', () => ({ createSpeakerPlayer: jest.fn() }));
const factory = jest.mocked(createSpeakerPlayer);
let instances: {
  play: jest.Mock;
  stop: jest.Mock;
  setVolume: jest.Mock;
  dispose: jest.Mock;
  emit: (value: boolean) => void;
  fail: () => void;
}[];
beforeEach(async () => {
  await AsyncStorage.clear();
  instances = [];
  factory.mockImplementation((_source, _volume, emit, fail) => {
    const player = {
      play: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      setVolume: jest.fn(),
      dispose: jest.fn(),
      emit,
      fail,
    };
    instances.push(player);
    return player;
  });
});
it('저장한 소리와 볼륨을 복원하지만 자동 재생하지 않는다', async () => {
  await AsyncStorage.setItem(
    'rougether.speaker.v1',
    JSON.stringify({ trackId: 'piano', volume: 0.6 }),
  );
  const { result } = await renderHook(() => useRoomSpeaker());
  expect(result.current.trackId).toBe('piano');
  expect(result.current.volume).toBe(0.6);
  expect(factory).not.toHaveBeenCalled();
  expect(result.current.playing).toBe(false);
});
it('실제 재생 이벤트 후 움직이며 소리 변경 전에 이전 플레이어를 제거한다', async () => {
  const { result, unmount } = await renderHook(() => useRoomSpeaker());
  await act(() => result.current.play());
  expect(result.current.loading).toBe(true);
  expect(result.current.playing).toBe(false);
  await act(() => instances[0].emit(true));
  expect(result.current.playing).toBe(true);
  await act(() => result.current.selectTrack('forest'));
  expect(instances[0].dispose).toHaveBeenCalledTimes(1);
  expect(instances).toHaveLength(2);
  await act(() => instances[0].emit(true));
  expect(result.current.playing).toBe(false);
  await act(() => instances[1].emit(true));
  expect(result.current.playing).toBe(true);
  await unmount();
  expect(instances[1].dispose).toHaveBeenCalledTimes(1);
});
it('정지 뒤 늦게 도착한 재생/실패 이벤트를 무시하고 스피커 배치 해제 시 정지한다', async () => {
  const { result, rerender } = await renderHook(
    ({ active }: { active: boolean }) => useRoomSpeaker(active),
    {
      initialProps: { active: true },
    },
  );
  await act(() => result.current.play());
  await act(() => result.current.stop());
  await act(() => {
    instances[0].emit(true);
    instances[0].fail();
  });
  expect(result.current.playing).toBe(false);
  expect(result.current.error).toBeNull();
  await act(() => result.current.play());
  await rerender({ active: false });
  expect(instances[1].dispose).toHaveBeenCalled();
  await act(() => result.current.play());
  expect(instances).toHaveLength(2);
});
it('볼륨을 제한하고 저장하며 로딩 오류 후 다시 재생할 수 있다', async () => {
  const { result } = await renderHook(() => useRoomSpeaker());
  await act(() => result.current.play());
  await act(() => result.current.setVolume(2));
  expect(instances[0].setVolume).toHaveBeenLastCalledWith(1);
  await act(() => result.current.setVolume(-1));
  expect(result.current.volume).toBe(0);
  expect(JSON.parse((await AsyncStorage.getItem('rougether.speaker.v1'))!).volume).toBe(0);
  await act(() => instances[0].fail());
  expect(result.current.error).toBeTruthy();
  await act(() => result.current.play());
  expect(result.current.error).toBeNull();
});
it('소리 준비가 끝나지 않으면 취소 가능한 오류로 전환한다', async () => {
  jest.useFakeTimers();
  try {
    const { result } = await renderHook(() => useRoomSpeaker());
    await act(() => result.current.play());
    await act(() => jest.advanceTimersByTime(15000));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(instances[0].dispose).toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
