import { createSpeakerPlayer } from '@/lib/speaker-player.web';

type Node = {
  buffer: unknown;
  loop: boolean;
  onended: (() => void) | null;
  connect: jest.Mock;
  disconnect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
};
const nodes: Node[] = [];
class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  onstatechange: (() => void) | null = null;
  destination = {};
  resume = jest.fn().mockResolvedValue(undefined);
  close = jest.fn().mockResolvedValue(undefined);
  decodeAudioData = jest.fn().mockResolvedValue({ duration: 1 });
  createGain() {
    return {
      gain: { value: 0, setTargetAtTime: jest.fn() },
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
  }
  createBufferSource(): Node {
    const node: Node = {
      buffer: null,
      loop: false,
      onended: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      start: jest.fn(),
      // 실제 브라우저처럼 stop()이 ended 이벤트를 낸다.
      stop: jest.fn(() => node.onended?.()),
    };
    nodes.push(node);
    return node;
  }
}
jest.mock('expo-asset', () => ({
  Asset: { fromModule: () => ({ uri: 'https://cdn/rain-loop.wav' }) },
}));
beforeEach(() => {
  nodes.length = 0;
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  (globalThis as unknown as { fetch: unknown }).fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
});

it('loops the decoded buffer and reports playback', async () => {
  const onPlaying = jest.fn();
  const onError = jest.fn();
  const controller = createSpeakerPlayer(1, 0.5, onPlaying, onError);
  await controller.play();
  expect(nodes[0].loop).toBe(true);
  expect(nodes[0].start).toHaveBeenCalledTimes(1);
  expect(onPlaying).toHaveBeenLastCalledWith(true);
  expect(onError).not.toHaveBeenCalled();
  controller.dispose();
});

it('does not report a user stop as a playback error', async () => {
  const onPlaying = jest.fn();
  const onError = jest.fn();
  const controller = createSpeakerPlayer(1, 0.5, onPlaying, onError);
  await controller.play();
  controller.stop();
  expect(nodes[0].stop).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
  expect(onPlaying).toHaveBeenLastCalledWith(false);
  // 정지 뒤 다시 재생하면 새 노드로 시작한다.
  await controller.play();
  expect(nodes).toHaveLength(2);
  controller.dispose();
  expect(onError).not.toHaveBeenCalled();
});

it('reports an unexpected end while playing as an error', async () => {
  const onError = jest.fn();
  const controller = createSpeakerPlayer(1, 0.5, jest.fn(), onError);
  await controller.play();
  nodes[0].onended?.();
  expect(onError).toHaveBeenCalledTimes(1);
  controller.dispose();
});
