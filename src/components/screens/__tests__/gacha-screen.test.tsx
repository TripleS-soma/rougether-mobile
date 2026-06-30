import { act, fireEvent, render } from '@testing-library/react-native';

import { GachaScreen } from '@/components/screens/gacha-screen';

describe('GachaScreen', () => {
  it('renders the title and balance', async () => {
    const { getByText } = await render(<GachaScreen leafBalance={5600} />);
    expect(getByText('가챠')).toBeTruthy();
    expect(getByText('5,600')).toBeTruthy();
  });

  it('plays the pull animation: spend → charge → reveal → confirm', async () => {
    const onSpendLeaves = jest.fn(() => true);
    const onObtain = jest.fn();
    const { getByText, queryByText } = await render(
      <GachaScreen leafBalance={5600} onSpendLeaves={onSpendLeaves} onObtain={onObtain} />,
    );

    jest.useFakeTimers();
    try {
      fireEvent.press(getByText('1회 뽑기'));
      // Leaves spent immediately; charge overlay shows; reward not yet revealed.
      expect(onSpendLeaves).toHaveBeenCalledWith(250);
      expect(getByText('뽑는 중…')).toBeTruthy();
      expect(onObtain).not.toHaveBeenCalled();

      // Advance past the charge phase → reveal + onObtain.
      act(() => {
        jest.advanceTimersByTime(1600);
      });
      expect(onObtain).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String)]));
      expect(getByText('축하해요!')).toBeTruthy();

      // Confirm closes the overlay.
      fireEvent.press(getByText('확인'));
      expect(queryByText('축하해요!')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows an error and no overlay when the spend is rejected', async () => {
    const onSpendLeaves = jest.fn(() => false);
    const { getByText, queryByText } = await render(
      <GachaScreen leafBalance={5600} onSpendLeaves={onSpendLeaves} />,
    );

    fireEvent.press(getByText('1회 뽑기'));

    expect(onSpendLeaves).toHaveBeenCalledWith(250);
    expect(getByText('잎사귀가 부족해요.')).toBeTruthy();
    expect(queryByText('뽑는 중…')).toBeNull();
  });
});
