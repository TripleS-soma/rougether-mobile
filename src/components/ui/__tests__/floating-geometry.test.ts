import { actionBarBottomOffset } from '@/components/ui/action-bar-geometry';
import { navPillBottomOffset } from '@/components/ui/bottom-nav-geometry';
import { floatingBottomOffset } from '@/components/ui/floating-geometry';

describe('floatingBottomOffset', () => {
  it('sits 4px above the home indicator inset', () => {
    expect(floatingBottomOffset(34)).toBe(38);
  });

  it('keeps a 16px minimum on devices without an inset', () => {
    expect(floatingBottomOffset(0)).toBe(16);
    expect(floatingBottomOffset(12)).toBe(16);
  });

  it('is the rule both the bottom nav and the action bar use', () => {
    for (const inset of [0, 12, 20, 34, 48]) {
      expect(navPillBottomOffset(inset)).toBe(floatingBottomOffset(inset));
      expect(actionBarBottomOffset(inset)).toBe(floatingBottomOffset(inset));
    }
  });
});
