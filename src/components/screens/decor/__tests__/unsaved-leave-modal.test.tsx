import { fireEvent, render } from '@testing-library/react-native';

import { UnsavedLeaveModal } from '@/components/screens/decor/unsaved-leave-modal';

describe('UnsavedLeaveModal', () => {
  it('offers save / discard / stay and routes each to its callback', async () => {
    const onSaveAndLeave = jest.fn();
    const onLeaveWithoutSaving = jest.fn();
    const onStay = jest.fn();
    const { getByText, getByLabelText } = await render(
      <UnsavedLeaveModal
        visible
        onSaveAndLeave={onSaveAndLeave}
        onLeaveWithoutSaving={onLeaveWithoutSaving}
        onStay={onStay}
      />,
    );
    expect(getByText('변경사항을 저장할까요?')).toBeTruthy();
    expect(getByText('적용하지 않은 꾸미기 변경이 있어요.')).toBeTruthy();

    await fireEvent.press(getByLabelText('저장하고 나가기'));
    expect(onSaveAndLeave).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByLabelText('저장하지 않고 나가기'));
    expect(onLeaveWithoutSaving).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByLabelText('계속 꾸미기'));
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while hidden', async () => {
    const { queryByText } = await render(
      <UnsavedLeaveModal
        visible={false}
        onSaveAndLeave={() => {}}
        onLeaveWithoutSaving={() => {}}
        onStay={() => {}}
      />,
    );
    expect(queryByText('변경사항을 저장할까요?')).toBeNull();
  });
});
