import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { BottomSheet, shouldDismiss } from '@/components/ui/bottom-sheet';

describe('shouldDismiss (#469)', () => {
  it('닫는다: 충분히 끌어내렸거나(거리) 빠르게 튕겼을(속도) 때', () => {
    expect(shouldDismiss(120, 0)).toBe(true); // 거리 초과
    expect(shouldDismiss(20, 1.2)).toBe(true); // 빠른 플링
  });

  it('유지: 조금 끌다 놓으면(거리·속도 모두 미달) 제자리로', () => {
    expect(shouldDismiss(20, 0.1)).toBe(false);
    expect(shouldDismiss(0, 0)).toBe(false);
  });
});

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
