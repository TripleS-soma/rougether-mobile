import { parseRunnerMessage } from '@/features/minigame/runner-bridge';

describe('runner bridge', () => {
  it('accepts a valid transcript and copies the input array', () => {
    const jumpTicks = [180];
    const message = parseRunnerMessage(
      { channelId: 'test', type: 'finish', result: { ticks: 301, jumpTicks } },
      'test',
    );
    jumpTicks.push(200);
    expect(message).toEqual({
      channelId: 'test',
      type: 'finish',
      result: { ticks: 301, jumpTicks: [180] },
    });
  });

  it.each([
    '{',
    null,
    { channelId: 'another', type: 'ready' },
    { channelId: 'test', type: 'pause', paused: 'false' },
    { channelId: 'test', type: 'finish', result: { ticks: 0, jumpTicks: [] } },
    { channelId: 'test', type: 'finish', result: { ticks: 18001, jumpTicks: [] } },
    { channelId: 'test', type: 'finish', result: { ticks: 301, jumpTicks: [180, 180] } },
    { channelId: 'test', type: 'finish', result: { ticks: 301, jumpTicks: [200, 180] } },
    { channelId: 'test', type: 'finish', result: { ticks: 301, jumpTicks: [302] } },
  ])('rejects malformed or cross-run messages: %j', (raw) => {
    expect(parseRunnerMessage(raw, 'test')).toBeNull();
  });
});
