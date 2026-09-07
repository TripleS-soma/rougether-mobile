import { act, fireEvent, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { RoutineMenuSheet } from '@/components/screens/sheets/routine-menu-sheet';
import type { Routine } from '@/constants/routines';

const ROUTINE: Routine = { id: 'r1', title: '스트레칭', kind: 'routine' };
const TODO: Routine = { id: 't1', title: '우유 사기', kind: 'todo' };

async function renderSheet(
  item: Routine,
  extra: Partial<Parameters<typeof RoutineMenuSheet>[0]> = {},
) {
  const props = {
    item,
    done: false,
    onClose: jest.fn(),
    onRename: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onToggleComplete: jest.fn(),
    onEditTime: jest.fn(),
    onChangeDate: jest.fn(),
    ...extra,
  };
  return { props, ...(await render(<RoutineMenuSheet {...props} />)) };
}

describe('RoutineMenuSheet', () => {
  it.each([
    [140, 0, State.END, true],
    [24, 800, State.END, true],
    [24, 200, State.END, false],
    [-24, 800, State.END, false],
    [140, 800, State.CANCELLED, false],
    [140, 800, State.FAILED, false],
  ])('downward drag %ipx at %ipx/s ending in %i closes: %s', async (dy, vy, state, closes) => {
    const { props } = await renderSheet(ROUTINE);
    await act(async () => {
      fireGestureHandler(getByGestureTestId('bottom-sheet-dismiss-pan'), [
        { state: State.BEGAN },
        { state: State.ACTIVE, translationY: 0 },
        { state: State.ACTIVE, translationY: dy },
        { state, translationY: dy, velocityY: vy },
      ]);
    });
    expect(props.onClose).toHaveBeenCalledTimes(closes ? 1 : 0);
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(props.onToggleComplete).not.toHaveBeenCalled();
    expect(props.onEdit).not.toHaveBeenCalled();
  });

  it('accepts a new dismiss drag after cancellation', async () => {
    const { props } = await renderSheet(TODO);
    await act(async () => {
      for (const state of [State.CANCELLED, State.END]) {
        fireGestureHandler(getByGestureTestId('bottom-sheet-dismiss-pan'), [
          { state: State.BEGAN },
          { state: State.ACTIVE, translationY: 0 },
          { state, translationY: 120, velocityY: 0 },
        ]);
      }
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('루틴은 이름 변경과 루틴 수정을 모두 보여준다', async () => {
    const { getByText } = await renderSheet(ROUTINE);
    expect(getByText('이름 변경')).toBeTruthy();
    expect(getByText('루틴 수정')).toBeTruthy();
  });

  it('루틴 수정을 누르면 시트를 닫고 그 루틴으로 onEdit을 호출한다', async () => {
    const { props, getByLabelText } = await renderSheet(ROUTINE);
    await fireEvent.press(getByLabelText('스트레칭 루틴 수정'));
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onEdit).toHaveBeenCalledWith(ROUTINE);
  });

  it('투두에는 루틴 수정을 숨긴다 (이름 변경은 유지)', async () => {
    const { queryByText, getByText } = await renderSheet(TODO);
    expect(queryByText('루틴 수정')).toBeNull();
    expect(getByText('이름 변경')).toBeTruthy();
  });
});
