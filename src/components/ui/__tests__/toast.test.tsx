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
});
