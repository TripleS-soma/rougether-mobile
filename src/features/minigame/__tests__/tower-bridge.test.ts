import { parseTowerMessage, towerReplay } from '@/features/minigame/tower-bridge';
import { createTowerHtml } from '@/features/minigame/tower-html';

const channelId = 'tower-test';
const finish = (ticks: unknown, dropTicks: unknown) => ({
  channelId,
  type: 'finish',
  result: { ticks, dropTicks },
});

describe('tower message boundary', () => {
  it('accepts the bounded replay and copies only validated fields', () => {
    const message = { ...finish(20, [1, 7, 20]), extra: true };
    const parsed = parseTowerMessage(JSON.stringify(message), channelId);
    expect(parsed).toEqual({
      channelId,
      type: 'finish',
      result: { ticks: 20, dropTicks: [1, 7, 20] },
    });
    expect(parseTowerMessage(finish(18000, []), channelId)).not.toBeNull();
    const longest = Array.from({ length: 3000 }, (_, i) => 1 + i * 6);
    expect(parseTowerMessage(finish(18000, longest), channelId)).not.toBeNull();
  });

  it('maps drop ticks onto the runner request field the server reuses', () => {
    const dropTicks = [3, 40];
    const replay = towerReplay({ ticks: 50, dropTicks });
    expect(replay).toEqual({ ticks: 50, jumpTicks: [3, 40] });
    expect(replay.jumpTicks).not.toBe(dropTicks);
  });

  it.each([
    finish(0, []),
    finish(18001, []),
    finish(1.5, []),
    finish('10', []),
    finish(10, null),
    finish(10, [0]),
    finish(10, [11]),
    finish(10, [2.5]),
    finish(10, ['3']),
    finish(20, [5, 5]),
    finish(20, [8, 4]),
    // 쿨다운(6틱)보다 촘촘한 입력은 엔진이 기록하지 않는다.
    finish(20, [1, 6]),
    finish(
      18000,
      Array.from({ length: 3001 }, (_, i) => 1 + i * 6),
    ),
    { channelId: 'other', type: 'ready' },
    '{bad',
    'x'.repeat(120001),
    null,
  ])('rejects untrusted malformed or out-of-bounds messages %#', (message) => {
    expect(parseTowerMessage(message, channelId)).toBeNull();
  });

  it('passes ready and explicit boolean pause messages only', () => {
    expect(parseTowerMessage({ channelId, type: 'ready' }, channelId)).toEqual({
      channelId,
      type: 'ready',
    });
    expect(parseTowerMessage({ channelId, type: 'pause', paused: false }, channelId)).toEqual({
      channelId,
      type: 'pause',
      paused: false,
    });
    expect(parseTowerMessage({ channelId, type: 'pause', paused: 'no' }, channelId)).toBeNull();
  });
});

describe('tower document', () => {
  it('limits manual time to opted-in practice documents and escapes channel text', () => {
    const ranked = createTowerHtml({ seed: 1, channelId, allowManualTime: true });
    expect(ranked).toContain('"manualTime":false');
    expect(ranked).toContain("default-src 'none'");
    expect(ranked).toContain('"rulesVersion":3');
    const practice = createTowerHtml({
      seed: 1,
      channelId: '</script><img src=x>',
      practice: true,
      allowManualTime: true,
    });
    expect(practice).toContain('"manualTime":true');
    expect(practice).not.toContain('</script><img');
  });

  it('rejects seeds the engine would refuse', () => {
    expect(() => createTowerHtml({ seed: 0, channelId })).toThrow('Invalid tower seed');
    expect(() => createTowerHtml({ seed: 1.5, channelId })).toThrow('Invalid tower seed');
  });

  it('paints the boxes from the theme palette it is given', () => {
    const html = createTowerHtml({
      seed: 1,
      channelId,
      colors: { primary: '#123456', screen: '#ABCDEF' } as never,
    });
    expect(html).toContain('"primary":"#123456"');
    expect(html).toContain('background:#ABCDEF');
  });
});
