import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { ToastProvider, useToast } from '@/components/ui/toast';
import { Themes } from '@/constants/theme';

function Trigger() {
  const { show } = useToast();
  return (
    <Pressable accessibilityRole="button" onPress={() => show('저장에 실패했어요', 'error')}>
      <Text>fire</Text>
    </Pressable>
  );
}

describe('Toast', () => {
  it('shows a message when fired and renders nothing before', async () => {
    const { getByText, queryByText } = await render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    expect(queryByText('저장에 실패했어요')).toBeNull();
    await fireEvent.press(getByText('fire'));
    expect(getByText('저장에 실패했어요')).toBeTruthy();
  });

  it('면은 GlassSurface — 글래스 불가 환경에선 토스트 색 단색 폴백 (#1131)', async () => {
    function Trigger() {
      const { show } = useToast();
      return (
        <Pressable onPress={() => show('저장했어요', 'success')}>
          <Text>fire</Text>
        </Pressable>
      );
    }
    const { getByText, getByTestId } = await render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await fireEvent.press(getByText('fire'));
    const flat = Object.assign({}, ...[getByTestId('toast-face').props.style].flat(Infinity));
    expect(flat.backgroundColor).toBe(Themes.cozy.success);
  });

  it('useToast is a safe no-op without a provider', async () => {
    // Rendering the trigger outside a provider must not throw on press.
    const { getByText } = await render(<Trigger />);
    await fireEvent.press(getByText('fire'));
  });

  it('dismisses when touching anywhere else', async () => {
    const { getByText, queryByText } = await render(
      <ToastProvider>
        <Trigger />
        <Text>elsewhere</Text>
      </ToastProvider>,
    );

    await fireEvent.press(getByText('fire'));
    expect(getByText('저장에 실패했어요')).toBeTruthy();

    // A touch anywhere in the app bubbles to the provider wrapper and hides it.
    await fireEvent(getByText('elsewhere'), 'touchStart');
    await waitFor(() => expect(queryByText('저장에 실패했어요')).toBeNull());
  });

  it('dismisses when the toast itself is tapped', async () => {
    const { getByText, getByLabelText, queryByText } = await render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await fireEvent.press(getByText('fire'));
    await fireEvent.press(getByLabelText('알림 닫기'));
    await waitFor(() => expect(queryByText('저장에 실패했어요')).toBeNull());
  });

  /**
   * 동작 버튼 토스트 (#1676) — "실행 취소"처럼 방금 한 일을 되돌릴 때. 다른 곳을 눌러도 남아야
   * 되돌릴 기회를 빼앗지 않는다.
   */
  it('동작 버튼을 누르면 그 동작을 부르고 닫힌다 — 다른 곳을 눌러도 남는다 (#1676)', async () => {
    const undo = jest.fn();
    function UndoTrigger() {
      const { show } = useToast();
      return (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            show('할 일을 삭제했어요', 'info', { action: { label: '실행 취소', onPress: undo } })
          }>
          <Text>fire</Text>
        </Pressable>
      );
    }
    const { getByText, getByLabelText, queryByText } = await render(
      <ToastProvider>
        <UndoTrigger />
        <Text>elsewhere</Text>
      </ToastProvider>,
    );
    await fireEvent.press(getByText('fire'));
    await fireEvent(getByText('elsewhere'), 'touchStart');
    expect(getByText('할 일을 삭제했어요')).toBeTruthy();
    await fireEvent.press(getByLabelText('실행 취소'));
    expect(undo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(queryByText('할 일을 삭제했어요')).toBeNull());
  });

  it('다른 토스트가 덮으면 onDismiss를 부르고, 동작을 고르면 부르지 않는다 (#1677 리뷰)', async () => {
    const dismissed = jest.fn();
    const undo = jest.fn();
    function Triggers() {
      const { show } = useToast();
      return (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              show('삭제했어요', 'info', {
                action: { label: '실행 취소', onPress: undo },
                onDismiss: dismissed,
              })
            }>
            <Text>undoable</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => show('보상 받았어요')}>
            <Text>other</Text>
          </Pressable>
        </>
      );
    }
    const ui = await render(
      <ToastProvider>
        <Triggers />
      </ToastProvider>,
    );
    await fireEvent.press(ui.getByText('undoable'));
    await fireEvent.press(ui.getByText('other'));
    // 실행 취소 버튼이 사라졌다 — 보류를 끝내라는 신호.
    expect(dismissed).toHaveBeenCalledTimes(1);

    dismissed.mockClear();
    await fireEvent.press(ui.getByText('undoable'));
    await fireEvent.press(ui.getByLabelText('실행 취소'));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(dismissed).not.toHaveBeenCalled();
  });
});
