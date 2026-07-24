import { fireEvent, render } from '@testing-library/react-native';

import { Calendar } from '@/components/ui/calendar';

describe('Calendar', () => {
  it('renders the month of the selected date and selects a day', async () => {
    const onSelect = jest.fn();
    const { getByText } = await render(<Calendar value="2026-06-15" onSelect={onSelect} />);

    expect(getByText('2026년 6월')).toBeTruthy();
    fireEvent.press(getByText('20'));
    expect(onSelect).toHaveBeenCalledWith('2026-06-20');
  });

  it('renders previous/next month controls', async () => {
    const { getByLabelText } = await render(<Calendar value="2026-06-15" onSelect={() => {}} />);
    expect(getByLabelText('이전 달')).toBeTruthy();
    expect(getByLabelText('다음 달')).toBeTruthy();
  });

  it('does not select a day outside the min/max bounds', async () => {
    const onSelect = jest.fn();
    const { getByText } = await render(
      <Calendar value="2026-06-15" min="2026-06-10" max="2026-06-20" onSelect={onSelect} />,
    );
    fireEvent.press(getByText('5')); // before min → ignored
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows the 오늘 chip while off-today and jumps back on press (#467)', async () => {
    const onSelect = jest.fn();
    const { getByLabelText } = await render(
      <Calendar value="2026-06-15" today="2026-07-24" onSelect={onSelect} />,
    );
    fireEvent.press(getByLabelText('오늘로'));
    expect(onSelect).toHaveBeenCalledWith('2026-07-24');
  });

  it('hides the 오늘 chip when already on today', async () => {
    const { queryByLabelText } = await render(
      <Calendar value="2026-07-24" today="2026-07-24" onSelect={() => {}} />,
    );
    expect(queryByLabelText('오늘로')).toBeNull();
  });

  it('never shows the 오늘 chip without a today prop (date-picker sheets)', async () => {
    const { queryByLabelText } = await render(<Calendar value="2026-06-15" onSelect={() => {}} />);
    expect(queryByLabelText('오늘로')).toBeNull();
  });
});
