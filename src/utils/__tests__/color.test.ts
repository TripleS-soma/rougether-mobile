import { contrastRatio, readableTextColor } from '@/utils/color';

describe('contrastRatio', () => {
  it('matches the WCAG reference for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#7FA87F', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#7FA87F'), 8);
  });

  it('treats unparseable colors as passing (no forced adjustment)', () => {
    expect(contrastRatio('tomato', '#FFFFFF')).toBe(21);
  });
});

describe('readableTextColor', () => {
  // The failing pairs the 2026-07 UX audit found (#232): category colors as
  // label text on light surfaces.
  const CATEGORY_COLORS = ['#E8A87C', '#7FA8D4', '#C8869C', '#7FA87F', '#B5A89C'];

  it.each(CATEGORY_COLORS)('darkens %s to AA on a light surface', (color) => {
    const adjusted = readableTextColor(color, '#FFFFFF');
    expect(contrastRatio(adjusted, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CATEGORY_COLORS)('lightens %s to AA on a dark surface', (color) => {
    const adjusted = readableTextColor(color, '#362F26');
    expect(contrastRatio(adjusted, '#362F26')).toBeGreaterThanOrEqual(4.5);
  });

  it('returns the color unchanged when it already passes', () => {
    expect(readableTextColor('#000000', '#FFFFFF')).toBe('#000000');
  });

  it('returns the color unchanged when it is not #RRGGBB', () => {
    expect(readableTextColor('rebeccapurple', '#FFFFFF')).toBe('rebeccapurple');
  });

  it('falls back to the extreme on backgrounds no shade can beat', () => {
    // Mid-gray bg: ~4.3:1 vs white and ~4.9:1 vs black — 6:1 is only
    // reachable... nowhere near the original hue's lightness. Expect a hard
    // clamp rather than an infinite search.
    const adjusted = readableTextColor('#808080', '#808080', 6);
    expect(['#000000', '#FFFFFF']).toContain(adjusted);
  });
});
