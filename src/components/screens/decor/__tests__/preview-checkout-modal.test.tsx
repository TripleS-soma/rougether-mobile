import { fireEvent, render } from '@testing-library/react-native';

import { PreviewCheckoutModal } from '@/components/screens/decor/preview-checkout-modal';

const previews = [
  { id: 'bed', name: '포근한 침대', price: 30 },
  { id: 'wp-1', name: '따뜻한 벽지', price: 20 },
];

const base = {
  visible: true,
  previews,
  total: 50,
  diamondBalance: 100,
  buying: false,
  canBuy: true,
  onBuyAllAndSave: () => {},
  onSaveWithoutPreviews: () => {},
  onDismiss: () => {},
};

describe('PreviewCheckoutModal (#501)', () => {
  it('lists every preview with the total and balance, and routes the three actions', async () => {
    const onBuyAllAndSave = jest.fn();
    const onSaveWithoutPreviews = jest.fn();
    const onDismiss = jest.fn();
    const { getByText, getByLabelText } = await render(
      <PreviewCheckoutModal
        {...base}
        onBuyAllAndSave={onBuyAllAndSave}
        onSaveWithoutPreviews={onSaveWithoutPreviews}
        onDismiss={onDismiss}
      />,
    );
    expect(getByText('구매하지 않은 프리뷰가 2개 있어요')).toBeTruthy();
    expect(getByText('포근한 침대')).toBeTruthy();
    expect(getByText('따뜻한 벽지')).toBeTruthy();
    expect(getByText('합계 (보유 100)')).toBeTruthy();
    expect(getByText('50')).toBeTruthy();

    await fireEvent.press(getByLabelText('모두 구매하고 저장'));
    expect(onBuyAllAndSave).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByLabelText('제외하고 저장'));
    expect(onSaveWithoutPreviews).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByLabelText('프리뷰 계속 보기'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('disables bulk buy with a 부족 label when the balance cannot cover the total', async () => {
    const onBuyAllAndSave = jest.fn();
    const { getByLabelText, getByText } = await render(
      <PreviewCheckoutModal {...base} diamondBalance={49} onBuyAllAndSave={onBuyAllAndSave} />,
    );
    const btn = getByLabelText('모두 구매하고 저장');
    expect(btn.props.accessibilityState).toEqual({ disabled: true });
    expect(getByText('다이아가 부족해요')).toBeTruthy();
    await fireEvent.press(btn);
    expect(onBuyAllAndSave).not.toHaveBeenCalled();
  });

  it('disables bulk buy when no buy path is wired (canBuy=false)', async () => {
    const { getByLabelText } = await render(<PreviewCheckoutModal {...base} canBuy={false} />);
    expect(getByLabelText('모두 구매하고 저장').props.accessibilityState).toEqual({
      disabled: true,
    });
  });

  it('shows 구매 중... and locks both save buttons while buying', async () => {
    const onSaveWithoutPreviews = jest.fn();
    const { getByText, getByLabelText } = await render(
      <PreviewCheckoutModal {...base} buying onSaveWithoutPreviews={onSaveWithoutPreviews} />,
    );
    expect(getByText('구매 중...')).toBeTruthy();
    expect(getByLabelText('모두 구매하고 저장').props.accessibilityState).toEqual({
      disabled: true,
    });
    await fireEvent.press(getByLabelText('제외하고 저장'));
    expect(onSaveWithoutPreviews).not.toHaveBeenCalled();
  });
});
