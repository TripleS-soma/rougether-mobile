import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';

describe('BottomSheet', () => {
  it('열림 렌더·백드롭 닫기·퇴장 후 언마운트 계약 (#448)', async () => {
    const onClose = jest.fn();
    const ui = await render(
      <BottomSheet visible onClose={onClose}>
        <Text>시트 내용</Text>
      </BottomSheet>,
    );
    expect(ui.getByText('시트 내용')).toBeTruthy();

    await fireEvent.press(ui.getByLabelText('시트 닫기'));
    expect(onClose).toHaveBeenCalledTimes(1);

    // visible=false 전환 → 퇴장 애니메이션이 끝난 뒤에야 사라진다.
    await ui.rerender(
      <BottomSheet visible={false} onClose={onClose}>
        <Text>시트 내용</Text>
      </BottomSheet>,
    );
    await waitFor(() => expect(ui.queryByText('시트 내용')).toBeNull());
  });

  it('처음부터 닫혀 있으면 아무것도 그리지 않는다', async () => {
    const { queryByText } = await render(
      <BottomSheet visible={false}>
        <Text>숨김</Text>
      </BottomSheet>,
    );
    expect(queryByText('숨김')).toBeNull();
  });
});
