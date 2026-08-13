import { fireEvent, render } from '@testing-library/react-native';

import { RetryState } from '@/components/ui/retry-state';

describe('RetryState', () => {
  it('renders the message and fires onRetry from the 다시 시도 button', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RetryState message="데이터를 불러오지 못했어요." onRetry={onRetry} />,
    );
    expect(getByText('데이터를 불러오지 못했어요.')).toBeTruthy();
    await fireEvent.press(getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders the detail line when provided', async () => {
    const { getByText } = await render(
      <RetryState
        message="친구 방을 불러오지 못했어요"
        detail="네트워크 상태를 확인하고 다시 시도해 주세요."
        onRetry={() => {}}
      />,
    );
    expect(getByText('친구 방을 불러오지 못했어요')).toBeTruthy();
    expect(getByText('네트워크 상태를 확인하고 다시 시도해 주세요.')).toBeTruthy();
  });

  it('hides the button without onRetry and honors a custom retryLabel', async () => {
    const noRetry = await render(<RetryState message="불러오지 못했어요." />);
    expect(noRetry.queryByLabelText('다시 시도')).toBeNull();

    const onRetry = jest.fn();
    const custom = await render(
      <RetryState
        message="설정을 불러오지 못했어요."
        onRetry={onRetry}
        retryLabel="다시 불러오기"
      />,
    );
    await fireEvent.press(custom.getByLabelText('다시 불러오기'));
    expect(onRetry).toHaveBeenCalled();
  });
});
