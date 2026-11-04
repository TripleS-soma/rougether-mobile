import { Themes } from '@/constants/theme';
import { PRESSED_OPACITY, pressedStyle } from '@/components/ui/press-feedback';

describe('pressedStyle', () => {
  const t = Themes.cozy;

  it('maps each role to its pressed treatment', () => {
    expect(pressedStyle('fill', t)).toEqual({ backgroundColor: t.primaryActive });
    expect(pressedStyle('row', t)).toEqual({ backgroundColor: t.primarySoft });
    expect(pressedStyle('card', t)).toEqual({ backgroundColor: t.surfaceMuted });
    expect(pressedStyle('dim', t)).toEqual({ opacity: PRESSED_OPACITY });
  });
});
