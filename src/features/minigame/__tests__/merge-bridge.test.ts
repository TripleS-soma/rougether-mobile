import { parseMergeMessage } from '@/features/minigame/merge-bridge';
import { createMergeHtml } from '@/features/minigame/merge-html';

describe('merge document bridge', () => {
  it('copies valid actions and excludes client supplied score', () => {
    const actions = [{ tick: 2, direction: 'LEFT' }];
    const message = parseMergeMessage(
      { channelId: 'test', type: 'finish', result: { ticks: 10, actions, score: 999999 } },
      'test',
    );
    actions[0].tick = 8;
    expect(message).toEqual({
      channelId: 'test',
      type: 'finish',
      result: { ticks: 10, actions: [{ tick: 2, direction: 'LEFT' }] },
    });
  });

  it('allows a manual finish before the first move', () => {
    expect(
      parseMergeMessage(
        JSON.stringify({ channelId: 'test', type: 'finish', result: { ticks: 1, actions: [] } }),
        'test',
      ),
    ).not.toBeNull();
  });

  it.each([
    null,
    '{',
    'x'.repeat(160001),
    { channelId: 'other', type: 'ready' },
    { channelId: 'test', type: 'pause', paused: 'false' },
    ...[
      { ticks: 0, actions: [] },
      { ticks: 18001, actions: [] },
      { ticks: 10, actions: [{ tick: 1, direction: 'INVALID' }] },
      {
        ticks: 10,
        actions: [
          { tick: 1, direction: 'UP' },
          { tick: 1, direction: 'DOWN' },
        ],
      },
      {
        ticks: 10,
        actions: [
          { tick: 4, direction: 'UP' },
          { tick: 3, direction: 'DOWN' },
        ],
      },
      { ticks: 10, actions: [{ tick: 11, direction: 'UP' }] },
      { ticks: 10, actions: [{ tick: 1.5, direction: 'UP' }] },
      {
        ticks: 10000,
        actions: Array.from({ length: 2001 }, (_, i) => ({ tick: i + 1, direction: 'UP' })),
      },
      { ticks: 10, actions: [null] },
    ].map((result) => ({ channelId: 'test', type: 'finish', result })),
  ])('rejects invalid messages (%#)', (raw) => {
    expect(parseMergeMessage(raw, 'test')).toBeNull();
  });

  it('isolates the document and escapes the bridge channel', () => {
    const html = createMergeHtml({
      seed: 1,
      channelId: '</script><script>alert(1)</script>',
      allowManualTime: true,
    });
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain('</script><script>alert(1)</script>');
    expect(html).toContain('"manualTime":false');
    expect(html).toContain('event.source!==window.parent');
  });

  it('allows manual time only in explicitly enabled practice mode', () => {
    expect(
      createMergeHtml({ seed: 1, channelId: 'test', practice: true, allowManualTime: true }),
    ).toContain('"manualTime":true');
    expect(createMergeHtml({ seed: 1, channelId: 'test', practice: true })).toContain(
      '"manualTime":false',
    );
  });
});
