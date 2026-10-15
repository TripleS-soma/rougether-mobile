import { YarnBallColors } from '@/constants/theme';
import { parseYarnMessage } from '@/features/minigame/yarn-bridge';
import { createYarnHtml, yarnSymbolColors } from '@/features/minigame/yarn-html';
import { contrastRatio } from '@/utils/color';

const channelId = 'yarn-test';
const finish = (ticks: unknown, picks: unknown) => ({
  channelId,
  type: 'finish',
  result: { ticks, picks },
});

describe('yarn message boundary', () => {
  it('accepts the bounded replay and copies only validated fields', () => {
    const picks = [0, 5, 3];
    const parsed = parseYarnMessage(
      JSON.stringify({ ...finish(3, picks), extra: true }),
      channelId,
    );
    expect(parsed).toEqual({ channelId, type: 'finish', result: { ticks: 3, picks: [0, 5, 3] } });
    // 한 번도 안 집고 저장해도 틱은 최소 1.
    expect(parseYarnMessage(finish(1, []), channelId)).not.toBeNull();
    const longest = Array.from({ length: 2000 }, (_, i) => i % 6);
    expect(parseYarnMessage(finish(2000, longest), channelId)).not.toBeNull();
  });

  it.each([
    finish(0, []),
    finish(2, [1]),
    finish(1, [1, 2]),
    finish('1', [1]),
    finish(1, null),
    finish(1, [6]),
    finish(1, [-1]),
    finish(1, [1.5]),
    finish(1, ['1']),
    finish(
      2001,
      Array.from({ length: 2001 }, () => 0),
    ),
    { channelId: 'other', type: 'ready' },
    '{bad',
    'x'.repeat(40001),
    null,
  ])('rejects untrusted malformed or out-of-bounds messages %#', (message) => {
    expect(parseYarnMessage(message, channelId)).toBeNull();
  });

  it('passes ready and explicit boolean pause messages only', () => {
    expect(parseYarnMessage({ channelId, type: 'ready' }, channelId)).toEqual({
      channelId,
      type: 'ready',
    });
    expect(parseYarnMessage({ channelId, type: 'pause', paused: true }, channelId)).toEqual({
      channelId,
      type: 'pause',
      paused: true,
    });
    expect(parseYarnMessage({ channelId, type: 'pause', paused: 'no' }, channelId)).toBeNull();
  });
});

describe('yarn document', () => {
  it('bundles the engine, a strict CSP and the escaped channel', () => {
    const html = createYarnHtml({ seed: 1, channelId: '</script><img src=x>', practice: true });
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('"rulesVersion":3');
    expect(html).toContain('"practice":true');
    expect(html).toContain('function createYarnEngine');
    expect(html).not.toContain('</script><img');
    // 더미 6개 버튼 — 화면 낭독기·키보드로도 집을 수 있다.
    expect(html.match(/class="pile"/g)).toHaveLength(6);
  });

  it('rejects seeds the engine would refuse', () => {
    expect(() => createYarnHtml({ seed: 0, channelId })).toThrow('Invalid yarn seed');
    expect(() => createYarnHtml({ seed: 1.5, channelId })).toThrow('Invalid yarn seed');
  });

  it('uses the theme palette for the scene and fixed colorblind-safe yarn colors', () => {
    const html = createYarnHtml({
      seed: 1,
      channelId,
      colors: { primary: '#123456', screen: '#ABCDEF' } as never,
    });
    expect(html).toContain('"primary":"#123456"');
    expect(html).toContain('background:#ABCDEF');
    expect(html).toContain(`"ballColors":${JSON.stringify(YarnBallColors)}`);
  });

  it('draws every yarn symbol in a readable color on its ball', () => {
    const symbols = yarnSymbolColors();
    expect(symbols).toHaveLength(7);
    YarnBallColors.forEach((ball, i) => {
      expect(contrastRatio(symbols[i], ball)).toBeGreaterThanOrEqual(3);
    });
    expect(new Set(YarnBallColors).size).toBe(7);
  });
});
