import { fireEvent, render } from '@testing-library/react-native';

import { WalletPills } from '@/components/ui/wallet-pills';

describe('WalletPills', () => {
  it('shows balances up to four digits as-is', async () => {
    const { getByText } = await render(<WalletPills coin={9999} diamond={1234} />);
    expect(getByText('9,999')).toBeTruthy();
    expect(getByText('1,234')).toBeTruthy();
  });

  it('caps five-digit balances at 9999+ and reveals the real value on tap', async () => {
    const { getByText, queryByText } = await render(<WalletPills coin={123456} diamond={500} />);
    expect(getByText('9999+')).toBeTruthy();
    expect(queryByText('123,456')).toBeNull();

    await fireEvent.press(getByText('9999+'));
    expect(getByText('123,456')).toBeTruthy();

    // Tapping again re-caps.
    await fireEvent.press(getByText('123,456'));
    expect(getByText('9999+')).toBeTruthy();
  });

  it('keeps the real balance in the accessibility label even when capped', async () => {
    const { getByLabelText } = await render(<WalletPills coin={123456} diamond={500} />);
    expect(getByLabelText('코인 123456')).toBeTruthy();
    expect(getByLabelText('다이아 500')).toBeTruthy();
  });
});
