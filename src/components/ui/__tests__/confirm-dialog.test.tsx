import { fireEvent, render } from '@testing-library/react-native';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

describe('ConfirmDialog', () => {
  it('renders title/body and fires confirm + cancel', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { getByText, getByLabelText } = await render(
      <ConfirmDialog
        visible
        title="로그아웃할까요?"
        body="다시 이용하려면 로그인이 필요해요."
        confirmLabel="로그아웃"
        confirmAccessibilityLabel="로그아웃 확인"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(getByText('로그아웃할까요?')).toBeTruthy();
    expect(getByText('다시 이용하려면 로그인이 필요해요.')).toBeTruthy();

    await fireEvent.press(getByLabelText('로그아웃 확인'));
    expect(onConfirm).toHaveBeenCalled();
    await fireEvent.press(getByLabelText('취소'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders nothing while hidden', async () => {
    const { queryByText } = await render(
      <ConfirmDialog
        visible={false}
        title="루틴 삭제"
        body="삭제할까요?"
        confirmLabel="삭제"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(queryByText('루틴 삭제')).toBeNull();
  });

  it('omits the cancel button in confirm-only mode (cancelLabel=null)', async () => {
    const onConfirm = jest.fn();
    const { getByLabelText, queryByLabelText } = await render(
      <ConfirmDialog
        visible
        title="루틴을 먼저 정리해주세요"
        body="루틴을 옮긴 뒤 삭제할 수 있어요."
        confirmLabel="확인"
        confirmAccessibilityLabel="삭제 불가 확인"
        cancelLabel={null}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    expect(queryByLabelText('취소')).toBeNull();
    await fireEvent.press(getByLabelText('삭제 불가 확인'));
    expect(onConfirm).toHaveBeenCalled();
  });
});
