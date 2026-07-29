import { render } from '@testing-library/react-native';

import { CoinIcon } from '@/components/ui/coin-icon';
import { Icon } from '@/components/ui/icon';
import { readableTextColor } from '@/utils/color';

describe('CoinIcon (#512)', () => {
  it('renders the paw coin glyph', async () => {
    const { getByTestId } = await render(<CoinIcon size={18} />);
    expect(getByTestId('coin-icon')).toBeTruthy();
  });

  it('Icon name="coin" routes to the custom glyph (call sites unchanged)', async () => {
    const { getByTestId } = await render(<Icon name="coin" size={18} />);
    expect(getByTestId('coin-icon')).toBeTruthy();
  });

  it('tiny size still renders (발가락 단순화 변형)', async () => {
    const { getByTestId } = await render(<CoinIcon size={12} />);
    expect(getByTestId('coin-icon')).toBeTruthy();
  });

  it('면과 각인이 항상 다른 색이다 — 다크 동일 토큰에서도 (#572)', async () => {
    // 다크 팔레트는 warning == warningText(#EDB061) — 대비 강제 후엔 달라야 한다.
    expect(readableTextColor('#EDB061', '#EDB061', 3)).not.toBe('#EDB061');

    const { toJSON } = await render(<CoinIcon size={18} />);
    const findCircle = (node: any): any => {
      if (!node || typeof node !== 'object') return null;
      if (node.props?.stroke && node.props?.fill) return node;
      for (const child of node.children ?? []) {
        const hit = findCircle(child);
        if (hit) return hit;
      }
      return null;
    };
    const face = findCircle(toJSON());
    expect(face).toBeTruthy();
    expect(face.props.stroke).not.toBe(face.props.fill);
  });
});
