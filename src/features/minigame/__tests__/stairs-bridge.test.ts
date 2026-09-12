import { parseStairsMessage } from '@/features/minigame/stairs-bridge';
import { createStairsHtml } from '@/features/minigame/stairs-html';

const channelId = 'stairs-test';
const finish = (ticks: unknown, actions: unknown) => ({
  channelId,
  type: 'finish',
  result: { ticks, actions },
});

describe('stairs message boundary', () => {
  it('accepts the bounded replay and copies only validated fields', () => {
    const actions = [
      { tick: 1, direction: 'LEFT', injected: true },
      { tick: 7, direction: 'RIGHT' },
    ];
    const result = parseStairsMessage(JSON.stringify(finish(7, actions)), channelId);
    expect(result).toEqual({
      channelId,
      type: 'finish',
      result: {
        ticks: 7,
        actions: [
          { tick: 1, direction: 'LEFT' },
          { tick: 7, direction: 'RIGHT' },
        ],
      },
    });
    expect(parseStairsMessage(finish(180, []), channelId)).not.toBeNull();
  });

  it.each([
    finish(0, []),
    finish(7201, []),
    finish(1.5, []),
    finish(1, null),
    finish(7, [{ tick: 1, direction: 'UP' }]),
    finish(7, [{ tick: 0, direction: 'LEFT' }]),
    finish(7, [{ tick: 1, direction: 'left' }]),
    finish(7, [
      { tick: 1, direction: 'LEFT' },
      { tick: 6, direction: 'LEFT' },
    ]),
    finish(7, [
      { tick: 1, direction: 'LEFT' },
      { tick: 8, direction: 'LEFT' },
    ]),
    finish(7, [null]),
    finish(7200, Array(1201).fill({ tick: 1, direction: 'LEFT' })),
    { channelId: 'other', type: 'ready' },
    '{bad',
    'x'.repeat(120001),
    null,
  ])('rejects untrusted malformed or out-of-bounds messages %#', (message) => {
    expect(parseStairsMessage(message, channelId)).toBeNull();
  });

  it('allows only explicit booleans for pause state', () => {
    expect(parseStairsMessage({ channelId, type: 'pause', paused: true }, channelId)).toEqual({
      channelId,
      type: 'pause',
      paused: true,
    });
    expect(parseStairsMessage({ channelId, type: 'pause', paused: 1 }, channelId)).toBeNull();
  });

  it('limits manual time to opted-in practice documents and escapes channel text', () => {
    const ranked = createStairsHtml({ seed: 1, channelId, allowManualTime: true });
    expect(ranked).toContain('"manualTime":false');
    expect(ranked).toContain("default-src 'none'");
    const practice = createStairsHtml({
      seed: 1,
      channelId: '</script><img src=x>',
      practice: true,
      allowManualTime: true,
    });
    expect(practice).toContain('"manualTime":true');
    expect(practice).not.toContain('</script><img');
  });
});
