import { fireEvent, render } from '@testing-library/react-native';

import { GachaScreen } from '@/components/screens/gacha-screen';

describe('GachaScreen', () => {
  it('renders the title and balance', async () => {
    const { getByText } = await render(<GachaScreen leafBalance={5600} />);
    expect(getByText('가챠')).toBeTruthy();
    expect(getByText('5,600')).toBeTruthy();
  });

  it('spends leaves and reports obtained items on a pull', async () => {
    const onSpendLeaves = jest.fn(() => true);
    const onObtain = jest.fn();
    const { getByText } = await render(
      <GachaScreen leafBalance={5600} onSpendLeaves={onSpendLeaves} onObtain={onObtain} />,
    );

    await fireEvent.press(getByText('1회 뽑기'));

    expect(onSpendLeaves).toHaveBeenCalledWith(250);
    expect(onObtain).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String)]));
  });

  it('shows an error when the spend is rejected', async () => {
    const onSpendLeaves = jest.fn(() => false);
    const { getByText } = await render(
      <GachaScreen leafBalance={5600} onSpendLeaves={onSpendLeaves} />,
    );

    await fireEvent.press(getByText('1회 뽑기'));

    expect(onSpendLeaves).toHaveBeenCalledWith(250);
    expect(getByText('잎사귀가 부족해요.')).toBeTruthy();
  });
});
