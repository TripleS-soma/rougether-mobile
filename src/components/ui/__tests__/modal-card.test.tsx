import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ModalCard } from '@/components/ui/modal-card';

const setup = (disabled = false) => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  const ui = render(
    <ModalCard
      title="미션 만들기"
      cancel={{ label: '취소', accessibilityLabel: '미션 만들기 취소', onPress: onCancel }}
      confirm={{ label: '만들기', onPress: onConfirm, disabled }}>
      <Text>본문 폼</Text>
    </ModalCard>,
  );
  return { ui, onCancel, onConfirm };
};

describe('ModalCard', () => {
  it('제목·본문과 두 버튼을 그리고, 버튼마다 자기 콜백을 부른다', async () => {
    const { ui, onCancel, onConfirm } = setup();
    const { getByText, getByLabelText } = await ui;
    expect(getByText('미션 만들기')).toBeTruthy();
    expect(getByText('본문 폼')).toBeTruthy();
    await fireEvent.press(getByLabelText('미션 만들기 취소'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByLabelText('만들기'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('확정이 꺼져 있으면 비활성으로 읽히지만 눌림은 넘긴다 — 막힌 이유는 호출부가 알린다', async () => {
    const { ui, onConfirm } = setup(true);
    const { getByLabelText } = await ui;
    const confirm = getByLabelText('만들기');
    expect(confirm.props.accessibilityState).toEqual({ disabled: true });
    await fireEvent.press(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
