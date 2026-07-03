import { fireEvent, render } from '@testing-library/react-native';

import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { SAMPLE_ROUTINES } from '@/constants/routines';

describe('RoutineManageScreen', () => {
  it('shows an empty state with no routines', async () => {
    const { getByText } = await render(<RoutineManageScreen />);
    expect(getByText('아직 만든 루틴이 없어요.')).toBeTruthy();
  });

  it('shows a loading state instead of the empty state while loading', async () => {
    const { getByText, queryByText } = await render(<RoutineManageScreen loading />);
    expect(getByText('불러오는 중…')).toBeTruthy();
    expect(queryByText('아직 만든 루틴이 없어요.')).toBeNull();
  });

  it('shows an error state with retry when the load failed', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText } = await render(
      <RoutineManageScreen loadError onRetry={onRetry} />,
    );
    expect(getByText('데이터를 불러오지 못했어요.')).toBeTruthy();
    await fireEvent.press(getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders uncategorized routines in a 기타 group when there are no categories', async () => {
    const routines = [{ id: '2', title: '아침 기상', kind: 'routine' as const }];
    const { getByText } = await render(<RoutineManageScreen routines={routines} categories={[]} />);
    expect(getByText('기타')).toBeTruthy();
    expect(getByText('아침 기상')).toBeTruthy();
  });

  it('renders routines grouped by category', async () => {
    const { getByText } = await render(<RoutineManageScreen routines={SAMPLE_ROUTINES} />);
    expect(getByText('독서 30분')).toBeTruthy();
    expect(getByText('오후 9:30')).toBeTruthy();
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
