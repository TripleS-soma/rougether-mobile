import { fireEvent, render } from '@testing-library/react-native';

import { parse, TimePickerSheet, to24 } from '@/components/screens/sheets/time-picker-sheet';

const noop = () => {};

describe('time helpers', () => {
  it('converts a 12h selection to a 24h string', () => {
    expect(to24('PM', 9, 30)).toBe('21:30');
    expect(to24('AM', 7, 0)).toBe('07:00');
    expect(to24('PM', 12, 0)).toBe('12:00');
    expect(to24('AM', 12, 5)).toBe('00:05');
  });

  it('parses a 24h string into a 12h selection (minute snapped to 5)', () => {
    expect(parse('21:32')).toEqual({ ampm: 'PM', hour12: 9, minute: 30 });
    expect(parse('00:00')).toEqual({ ampm: 'AM', hour12: 12, minute: 0 });
  });
});

describe('TimePickerSheet', () => {
  it('renders the title and the enabled time controls', async () => {
    const { getByText } = await render(
      <TimePickerSheet visible initialEnabled initialTime="07:00" onSave={noop} onClose={noop} />,
    );
    expect(getByText('알림 시간')).toBeTruthy();
    expect(getByText('알림 받기')).toBeTruthy();
    expect(getByText('오전 7:00')).toBeTruthy(); // preview
  });

  it('saves the initial time through the footer', async () => {
    const onSave = jest.fn();
    const { getByText } = await render(
      <TimePickerSheet visible initialEnabled initialTime="07:00" onSave={onSave} onClose={noop} />,
    );
    fireEvent.press(getByText('저장'));
    expect(onSave).toHaveBeenCalledWith(true, '07:00');
  });
});
