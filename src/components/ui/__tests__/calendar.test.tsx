import { act, fireEvent, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

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
  // #561과 공용 유틸(utils/gesture)의 RNGH pan을 jest-utils로 구동한다.
  // (날짜 셀 탭 보존은 activeOffsetX 임계 담당 — 유틸 단위 테스트에서 검증.)
  it('그리드 가로 플링으로 이전/다음 달로 이동한다 (#562)', async () => {
    const { getByText, getByTestId } = await render(
      <Calendar value="2026-06-15" onSelect={() => {}} />,
    );
    expect(getByTestId('calendar-grid')).toBeTruthy();
    const fling = (translationX: number) =>
      act(async () =>
        fireGestureHandler(getByGestureTestId('calendar-month-fling'), [
          { state: State.BEGAN },
          { state: State.ACTIVE },
          { state: State.END, translationX, translationY: 0 },
        ]),
      );

    // 왼쪽 플링 → 다음 달, 오른쪽 플링 → 이전 달.
    await fling(-60);
    expect(getByText('2026년 7월')).toBeTruthy();
    await fling(60);
    expect(getByText('2026년 6월')).toBeTruthy();
    // 임계 미달 릴리즈는 월을 바꾸지 않는다.
    await fling(-30);
    expect(getByText('2026년 6월')).toBeTruthy();
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
