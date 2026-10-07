import { DarkThemes, Themes } from '@/constants/theme';
import {
  MERGE_TILE_COLOR_KEYS,
  createMergeHtml,
  mergePalette,
  mergeTileTextColors,
} from '@/features/minigame/merge-html';
import { contrastRatio } from '@/utils/color';

/** 합치기 타일 색 (2026-10-07) — 128·256·…·2048이 같은 색으로 묶이던 것. */
const palettes = [
  ['기본(원화)', mergePalette()],
  ...Object.entries(Themes).map(([id, t]) => [`라이트 ${id}`, mergePalette(t)] as const),
  ...Object.entries(DarkThemes).map(([id, t]) => [`다크 ${id}`, mergePalette(t)] as const),
] as const;

describe('합치기 타일 색', () => {
  it('2부터 2048까지 11단계', () => {
    expect(MERGE_TILE_COLOR_KEYS).toHaveLength(11); // 2^1 … 2^11
  });

  it.each(palettes)('%s — 11단계가 모두 다른 색', (_, palette) => {
    const colors = MERGE_TILE_COLOR_KEYS.map((key) => palette[key].toLowerCase());
    expect(new Set(colors).size).toBe(colors.length);
  });

  it.each(palettes)('%s — 글자는 흰/진한 중 대비가 큰 쪽', (_, palette) => {
    const text = mergeTileTextColors(palette);
    MERGE_TILE_COLOR_KEYS.forEach((key, i) => {
      const bg = palette[key];
      const other = text[i] === palette.white ? palette.ink : palette.white;
      expect(contrastRatio(text[i], bg)).toBeGreaterThanOrEqual(contrastRatio(other, bg));
    });
  });

  it('문서 설정에 단계별 배경·글자색이 실린다', () => {
    const html = createMergeHtml({ seed: 7, channelId: 'c' } as Parameters<
      typeof createMergeHtml
    >[0]);
    expect(html).toContain('"tileColors"');
    expect(html).toContain('"tileTextColors"');
  });
});
