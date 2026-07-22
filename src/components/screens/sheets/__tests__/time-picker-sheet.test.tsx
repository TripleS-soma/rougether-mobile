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
    const { getByText, getByLabelText } = await render(
      <TimePickerSheet visible initialEnabled initialTime="07:00" onSave={noop} onClose={noop} />,
    );
    // 미리보기 텍스트는 제거됨 — 선택 상태는 휠 자체가 보여준다.
    expect(getByLabelText('7시').props.accessibilityState.selected).toBe(true);
    expect(getByText('알림 시간')).toBeTruthy();
    expect(getByText('알림 받기')).toBeTruthy();
  });

  it('saves the initial time through the footer', async () => {
    const onSave = jest.fn();
    const { getByText } = await render(
      <TimePickerSheet visible initialEnabled initialTime="07:00" onSave={onSave} onClose={noop} />,
    );
    fireEvent.press(getByText('저장'));
    expect(onSave).toHaveBeenCalledWith(true, '07:00');
  });

  it('changes the time through the wheels and saves it (#390)', async () => {
    const onSave = jest.fn();
    const { getByText, getByLabelText } = await render(
      <TimePickerSheet visible initialEnabled initialTime="07:00" onSave={onSave} onClose={noop} />,
    );
    // 휠 행 탭 선택 — 스와이프와 같은 경로(onChange)로 커밋된다.
    await fireEvent.press(getByText('오후'));
    await fireEvent.press(getByLabelText('9시'));
    await fireEvent.press(getByLabelText('30분'));

    await fireEvent.press(getByText('저장'));
    expect(onSave).toHaveBeenCalledWith(true, '21:30');
  });

  it('re-syncs the wheels when reopened with a different time', async () => {
    const onSave = jest.fn();
    const ui = await render(
      <TimePickerSheet visible initialEnabled initialTime="21:30" onSave={onSave} onClose={noop} />,
    );
    expect(ui.getByLabelText('9시').props.accessibilityState.selected).toBe(true);
    expect(ui.getByLabelText('30분').props.accessibilityState.selected).toBe(true);
  });
});
