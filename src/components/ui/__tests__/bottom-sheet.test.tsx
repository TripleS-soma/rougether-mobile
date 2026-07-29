import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PanResponder, Text } from 'react-native';

import {
  BottomSheet,
  DRAG_CLAIM_HEIGHT,
  inDragClaimZone,
  shouldDismiss,
} from '@/components/ui/bottom-sheet';

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

describe('inDragClaimZone (#514)', () => {
  it('카드 상단(그립/헤더) 영역에서 시작한 터치만 시트 몫', () => {
    expect(inDragClaimZone(500, 500)).toBe(true); // 카드 최상단
    expect(inDragClaimZone(500 + DRAG_CLAIM_HEIGHT, 500)).toBe(true); // 경계 포함
    expect(inDragClaimZone(500 + DRAG_CLAIM_HEIGHT + 1, 500)).toBe(false); // 본문
    expect(inDragClaimZone(700, 500)).toBe(false); // 휠 등 깊은 본문
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

  // 휠 스크롤 경합 (#514) — 시트 pan은 카드 상단에서 시작한 드래그만 claim.
  it('본문(휠 영역)에서 시작한 세로 드래그는 시트가 클레임하지 않는다 (#514)', async () => {
    const createSpy = jest.spyOn(PanResponder, 'create');
    try {
      const ui = await render(
        <BottomSheet visible>
          <Text>시트 내용</Text>
        </BottomSheet>,
      );
      const config = createSpy.mock.calls[0][0];
      // 카드 레이아웃 주입: top 500, 높이 400. responder 핸들러가 있는 호스트에는
      // fireEvent('layout')이 전달되지 않아 onLayout prop을 직접 부른다.
      const card = ui.getByTestId('bottom-sheet-card');
      await act(async () =>
        card.props.onLayout({ nativeEvent: { layout: { y: 500, height: 400 } } }),
      );

      // 헤더 영역(카드 상단 64px 안)에서 시작한 아래 드래그 → 시트 몫.
      expect(
        config.onMoveShouldSetPanResponder?.(null as any, { dy: 20, dx: 0, y0: 540 } as any),
      ).toBe(true);
      // 본문(휠) 영역에서 시작 → 클레임하지 않아 휠 스크롤이 산다.
      expect(
        config.onMoveShouldSetPanResponder?.(null as any, { dy: 20, dx: 0, y0: 700 } as any),
      ).toBe(false);
      // 헤더 영역이라도 수직 우세가 아니면 클레임하지 않는다 (기존 규칙 유지).
      expect(
        config.onMoveShouldSetPanResponder?.(null as any, { dy: 10, dx: 30, y0: 540 } as any),
      ).toBe(false);
    } finally {
      createSpy.mockRestore();
    }
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
