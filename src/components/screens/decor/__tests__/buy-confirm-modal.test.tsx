import { fireEvent, render } from '@testing-library/react-native';

import { BuyConfirmModal } from '@/components/screens/decor/buy-confirm-modal';

const item = { name: '포근한 침대', price: 30 };

describe('BuyConfirmModal', () => {
  it('names the item and price, and routes 취소/구매 to the callbacks', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const { getByText, getByLabelText } = await render(
      <BuyConfirmModal item={item} phase="idle" onCancel={onCancel} onConfirm={onConfirm} />,
    );
    expect(getByText('구매하시겠습니까?')).toBeTruthy();
    expect(getByText(/포근한 침대.*다이아 30개로 구매해요/)).toBeTruthy();

    await fireEvent.press(getByLabelText('구매 취소'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByLabelText('구매 확인'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('locks both buttons while buying (#453) — spend is in flight', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const { getByLabelText } = await render(
      <BuyConfirmModal item={item} phase="buying" onCancel={onCancel} onConfirm={onConfirm} />,
    );
    const confirm = getByLabelText('구매 확인');
    expect(confirm.props.accessibilityState).toEqual({ disabled: true });
    await fireEvent.press(confirm);
    await fireEvent.press(getByLabelText('구매 취소'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('swaps the 구매 label for the check pop once done', async () => {
    const { getByTestId, queryByText } = await render(
      <BuyConfirmModal item={item} phase="done" onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(getByTestId('buy-done-check')).toBeTruthy();
    expect(queryByText('구매')).toBeNull();
  });

  it('is hidden when there is no pending item', async () => {
    const { queryByText } = await render(
      <BuyConfirmModal item={null} phase="idle" onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(queryByText('구매하시겠습니까?')).toBeNull();
  });
});
