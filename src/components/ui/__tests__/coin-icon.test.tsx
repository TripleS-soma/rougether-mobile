import { render } from '@testing-library/react-native';

import { CoinIcon } from '@/components/ui/coin-icon';
import { Icon } from '@/components/ui/icon';

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
});
