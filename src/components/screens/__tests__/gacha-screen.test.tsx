import { act, fireEvent, render } from '@testing-library/react-native';

import { GachaScreen } from '@/components/screens/gacha-screen';

describe('GachaScreen', () => {
  it('renders the title and balance', async () => {
    const { getByText } = await render(<GachaScreen leafBalance={5600} />);
    expect(getByText('가챠')).toBeTruthy();
    expect(getByText('5,600')).toBeTruthy();
  });

  it('spends leaves on press and reveals the reward only after the charge delay', async () => {
    const onSpendLeaves = jest.fn(() => true);
    const onObtain = jest.fn();
    const { getByText } = await render(
      <GachaScreen leafBalance={5600} onSpendLeaves={onSpendLeaves} onObtain={onObtain} />,
    );

    jest.useFakeTimers();
    try {
      fireEvent.press(getByText('1회 뽑기'));
      // Leaves are spent immediately, but the reward is held back during the
      // charge animation.
      expect(onSpendLeaves).toHaveBeenCalledWith(250);
      expect(onObtain).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1600);
      });
      expect(onObtain).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String)]));
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not reveal a reward when the spend is rejected', async () => {
    const onSpendLeaves = jest.fn(() => false);
    const onObtain = jest.fn();
    const { getByText } = await render(
      <GachaScreen leafBalance={5600} onSpendLeaves={onSpendLeaves} onObtain={onObtain} />,
    );

    jest.useFakeTimers();
    try {
      fireEvent.press(getByText('1회 뽑기'));
      expect(onSpendLeaves).toHaveBeenCalledWith(250);

      act(() => {
        jest.advanceTimersByTime(1600);
      });
      expect(onObtain).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
