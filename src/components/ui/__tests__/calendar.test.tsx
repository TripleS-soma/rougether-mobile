import { act, fireEvent, render } from '@testing-library/react-native';
import { PanResponder } from 'react-native';

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

  // 달력 월 스와이프 (#562) — 그리드 가로 플링이 ‹ ›와 같은 월 이동을 한다.
  // 판정은 #561과 공용 유틸(utils/gesture)의 config — PanResponder.create를
  // 스파이해 그 판정 콜백을 직접 구동한다.
  it('그리드 가로 플링으로 이전/다음 달로 이동한다 (#562)', async () => {
    const createSpy = jest.spyOn(PanResponder, 'create');
    try {
      const { getByText, getByTestId } = await render(
        <Calendar value="2026-06-15" onSelect={() => {}} />,
      );
      expect(getByTestId('calendar-grid')).toBeTruthy();
      const config = createSpy.mock.calls[0][0];

      // 왼쪽 플링 → 다음 달, 오른쪽 플링 → 이전 달.
      await act(async () => config.onPanResponderRelease?.(null as any, { dx: -60, dy: 0 } as any));
      expect(getByText('2026년 7월')).toBeTruthy();
      await act(async () => config.onPanResponderRelease?.(null as any, { dx: 60, dy: 0 } as any));
      expect(getByText('2026년 6월')).toBeTruthy();

      // 날짜 셀 탭 수준의 미세 이동은 클레임하지 않는다 — 탭 유지.
      expect(config.onMoveShouldSetPanResponder?.(null as any, { dx: 8, dy: 2 } as any)).toBe(
        false,
      );
      // 임계 미달 릴리즈는 월을 바꾸지 않는다.
      await act(async () => config.onPanResponderRelease?.(null as any, { dx: -30, dy: 0 } as any));
      expect(getByText('2026년 6월')).toBeTruthy();
    } finally {
      createSpy.mockRestore();
    }
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
