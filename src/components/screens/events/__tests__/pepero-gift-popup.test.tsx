import { fireEvent, render } from '@testing-library/react-native';

import { PeperoGiftPopup } from '@/components/screens/events/pepero-gift-popup';

it('shows both confirmed rewards and sends the bottom-left checkbox value with the decorating action', async () => {
  const onClose = jest.fn();
  const onGoDecor = jest.fn();
  const screen = await render(
    <PeperoGiftPopup visible onClose={onClose} onGoDecor={onGoDecor} onDismissed={jest.fn()} />,
  );
  expect(screen.getByText('111코인이 지급됐어요!')).toBeTruthy();
  expect(screen.getByText('한정 가구 · 11:11 소원 관측기')).toBeTruthy();
  expect(screen.getAllByText('지급 완료')).toHaveLength(2);
  await fireEvent.press(screen.getByRole('checkbox'));
  expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(true);
  await fireEvent.press(screen.getByText('꾸미러 바로 가기'));
  expect(onGoDecor).toHaveBeenCalledWith(true);
});

it('keeps a failed hide preference retryable and blocks actions while saving', async () => {
  const onClose = jest.fn();
  const screen = await render(
    <PeperoGiftPopup
      visible
      error
      dismissing
      onClose={onClose}
      onGoDecor={jest.fn()}
      onDismissed={jest.fn()}
    />,
  );
  expect(screen.getByText('숨김 설정을 저장하지 못했어요. 다시 시도해주세요.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('닫기'));
  expect(onClose).not.toHaveBeenCalled();
});
