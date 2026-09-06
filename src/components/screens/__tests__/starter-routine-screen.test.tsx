import { fireEvent, render } from '@testing-library/react-native';

import { StarterRoutineScreen } from '@/components/screens/starter-routine-screen';
import { recommendStarterRoutines } from '@/constants/starter-routines';

const recommendations = recommendStarterRoutines([{ id: 'reading', label: '독서' }]);

describe('첫 루틴 선택 화면', () => {
  it('선택한 한 개만 바로 추가하고 별도 입력 폼을 요구하지 않는다', async () => {
    const onStart = jest.fn();
    const ui = await render(
      <StarterRoutineScreen recommendations={recommendations} onStart={onStart} />,
    );
    await fireEvent.press(ui.getByText('이 루틴으로 시작하기'));
    expect(onStart).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByLabelText('책 2쪽 읽기'));
    await fireEvent.press(ui.getByText('이 루틴으로 시작하기'));
    expect(onStart).toHaveBeenCalledWith(recommendations[0]);
    expect(ui.queryByPlaceholderText('루틴 이름')).toBeNull();
    expect(ui.getByText(/알림은 꺼져 있고/)).toBeTruthy();
  });

  it('나중에는 생성 요청 없이 빠져나가고 저장 중에는 모든 행동을 막는다', async () => {
    const onSkip = jest.fn();
    const onStart = jest.fn();
    const ui = await render(
      <StarterRoutineScreen recommendations={recommendations} onSkip={onSkip} onStart={onStart} />,
    );
    await fireEvent.press(ui.getByText('나중에 할게요'));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
    await ui.rerender(
      <StarterRoutineScreen
        recommendations={recommendations}
        onSkip={onSkip}
        onStart={onStart}
        saving
      />,
    );
    await fireEvent.press(ui.getByText('나중에 할게요'));
    await fireEvent.press(ui.getByLabelText('책 2쪽 읽기'));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('저장 실패 때 선택을 유지하고 다시 확인을 생성과 분리한다', async () => {
    const onReload = jest.fn();
    const onStart = jest.fn();
    const ui = await render(
      <StarterRoutineScreen recommendations={recommendations} onStart={onStart} />,
    );
    await fireEvent.press(ui.getByLabelText('책 2쪽 읽기'));
    await ui.rerender(
      <StarterRoutineScreen
        recommendations={recommendations}
        onStart={onStart}
        onReload={onReload}
        needsReload
        error="다시 확인해 주세요"
      />,
    );
    expect(ui.getByLabelText('책 2쪽 읽기').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(ui.getByText('다시 확인하기'));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });
});
