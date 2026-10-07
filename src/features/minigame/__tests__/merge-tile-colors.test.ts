import {
  MERGE_TILE_COLOR_KEYS,
  MERGE_TILE_LIGHT_TEXT,
  createMergeHtml,
} from '@/features/minigame/merge-html';
import { RunnerPalette } from '@/features/minigame/runner-palette';

/** 합치기 타일 색 (2026-10-07) — 128·256·…·2048이 같은 색으로 묶이던 것. */
describe('합치기 타일 색', () => {
  it('2부터 2048까지 11단계가 모두 다른 색이다', () => {
    expect(MERGE_TILE_COLOR_KEYS).toHaveLength(11); // 2^1 … 2^11
    const colors = MERGE_TILE_COLOR_KEYS.map((key) => RunnerPalette[key]);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('글자색 표가 색 단계와 같은 길이다', () => {
    expect(MERGE_TILE_LIGHT_TEXT).toHaveLength(MERGE_TILE_COLOR_KEYS.length);
  });

  it('문서 설정에 단계별 색이 실린다', () => {
    const html = createMergeHtml({ seed: 7, channelId: 'c' } as Parameters<
      typeof createMergeHtml
    >[0]);
    for (const key of MERGE_TILE_COLOR_KEYS) expect(html).toContain(RunnerPalette[key]);
    expect(html).toContain('"tileColors"');
  });
});
