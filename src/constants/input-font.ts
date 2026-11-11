/**
 * NanumSquareRound and SUIT contain mapped but empty Hangul glyphs (e.g. 겓).
 * A mapped glyph prevents OS font fallback, so intermediate Korean syllables
 * become invisible. Inputs need all 11,172 modern Hangul syllables, including
 * uncommon ones produced while typing/backspacing. Keep the original weight.
 * See input-font-coverage.json and scripts/audit-input-fonts.py for asset proof.
 */
export const INPUT_FONT_FALLBACKS: Readonly<Record<string, string>> = {
  NanumSquareRoundR: 'Pretendard-Regular',
  NanumSquareRoundB: 'Pretendard-SemiBold',
  NanumSquareRoundEB: 'Pretendard-Bold',
  'SUIT-Regular': 'Pretendard-Regular',
  'SUIT-Medium': 'Pretendard-Medium',
  'SUIT-SemiBold': 'Pretendard-SemiBold',
  'SUIT-Bold': 'Pretendard-Bold',
  'Jua-Regular': 'Pretendard-Regular',
};

export function inputFontFamily(fontFamily: string | undefined): string | undefined {
  return fontFamily ? (INPUT_FONT_FALLBACKS[fontFamily] ?? fontFamily) : fontFamily;
}
