import { fireEvent, render } from '@testing-library/react-native';

import { DateRangeSheet } from '@/components/screens/sheets/date-range-sheet';

const noop = () => {};

describe('DateRangeSheet', () => {
  it('renders the title and start/end controls when visible', async () => {
    const { getByText } = await render(
      <DateRangeSheet visible initialStartDate="2026-06-29" onSave={noop} onClose={noop} />,
    );
    expect(getByText('지속 기간')).toBeTruthy();
    expect(getByText('시작일')).toBeTruthy();
    expect(getByText('종료일 설정')).toBeTruthy();
  });

  it('renders nothing when hidden', async () => {
    const { queryByText } = await render(
      <DateRangeSheet visible={false} initialStartDate="2026-06-29" onSave={noop} onClose={noop} />,
    );
    expect(queryByText('지속 기간')).toBeNull();
  });

  it('saves the start date with no end date by default', async () => {
    const onSave = jest.fn();
    const { getByText } = await render(
      <DateRangeSheet visible initialStartDate="2026-06-29" onSave={onSave} onClose={noop} />,
    );
    fireEvent.press(getByText('저장'));
    expect(onSave).toHaveBeenCalledWith('2026-06-29', undefined);
  });

  it('saves the end date when one was provided', async () => {
    const onSave = jest.fn();
    const { getByText } = await render(
      <DateRangeSheet
        visible
        initialStartDate="2026-06-01"
        initialEndDate="2026-06-20"
        onSave={onSave}
        onClose={noop}
      />,
    );
    fireEvent.press(getByText('저장'));
    expect(onSave).toHaveBeenCalledWith('2026-06-01', '2026-06-20');
  });
});
