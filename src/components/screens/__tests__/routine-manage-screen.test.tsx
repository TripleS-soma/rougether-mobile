import { fireEvent, render } from '@testing-library/react-native';

import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { SAMPLE_ROUTINES } from '@/constants/routines';

describe('RoutineManageScreen', () => {
  it('shows an empty state with no routines', async () => {
    const { getByText } = await render(<RoutineManageScreen />);
    expect(getByText('아직 만든 루틴이 없어요.')).toBeTruthy();
  });

  it('renders routines grouped by category', async () => {
    const { getByText } = await render(<RoutineManageScreen routines={SAMPLE_ROUTINES} />);
    expect(getByText('독서 30분')).toBeTruthy();
    expect(getByText('🔔 오후 9:30')).toBeTruthy();
  });

  it('calls onEdit / onAdd / onBack', async () => {
    const onEdit = jest.fn();
    const onAdd = jest.fn();
    const onBack = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoutineManageScreen
        routines={SAMPLE_ROUTINES}
        onEdit={onEdit}
        onAdd={onAdd}
        onBack={onBack}
      />,
    );

    await fireEvent.press(getByText('영어 공부'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: '4' }));

    await fireEvent.press(getByLabelText('루틴 추가'));
    expect(onAdd).toHaveBeenCalledTimes(1);

    await fireEvent.press(getByLabelText('뒤로가기'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
