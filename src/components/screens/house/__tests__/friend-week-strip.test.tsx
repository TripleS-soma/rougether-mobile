import { fireEvent, render } from '@testing-library/react-native';

import { FriendWeekStrip, weekStartOf } from '@/components/screens/house/friend-week-strip';

describe('weekStartOf (#1423)', () => {
  it('그 주의 일요일을 돌려준다 — 월·연 경계도', () => {
    expect(weekStartOf('2026-09-27')).toBe('2026-09-27'); // 일요일
    expect(weekStartOf('2026-09-30')).toBe('2026-09-27'); // 수요일
    expect(weekStartOf('2026-10-03')).toBe('2026-09-27'); // 토요일, 다음 달
    expect(weekStartOf('2027-01-01')).toBe('2026-12-27'); // 금요일, 다음 해
  });
});

describe('FriendWeekStrip (#1423)', () => {
  const TODAY = '2026-09-30'; // 수요일 — 주는 9/27(일)~10/3(토)

  it('선택 날짜의 주 7칸을 그리고, 누르면 그 날짜로 onSelect', async () => {
    const onSelect = jest.fn();
    const ui = await render(<FriendWeekStrip selected={TODAY} today={TODAY} onSelect={onSelect} />);
    expect(ui.getByText('9월 27일 – 10월 3일')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText(/^2026-09-28/));
    expect(onSelect).toHaveBeenLastCalledWith('2026-09-28');
  });

  it('‹ › 는 같은 요일로 한 주 이동', async () => {
    const onSelect = jest.fn();
    const ui = await render(<FriendWeekStrip selected={TODAY} today={TODAY} onSelect={onSelect} />);
    await fireEvent.press(ui.getByLabelText('이전 주'));
    expect(onSelect).toHaveBeenLastCalledWith('2026-09-23');
    await fireEvent.press(ui.getByLabelText('다음 주'));
    expect(onSelect).toHaveBeenLastCalledWith('2026-10-07');
  });

  it('완료한 날은 "n개 완료", 안 한 과거는 "완료 없음", 미래는 점 없음', async () => {
    const ui = await render(
      <FriendWeekStrip
        selected={TODAY}
        today={TODAY}
        onSelect={jest.fn()}
        doneCounts={{ '2026-09-28': 3 }}
      />,
    );
    expect(ui.getByLabelText('2026-09-28, 3개 완료')).toBeTruthy();
    expect(ui.getByLabelText('2026-09-29, 완료 없음')).toBeTruthy();
    expect(ui.getByLabelText('2026-09-30, 오늘, 완료 없음')).toBeTruthy();
    expect(ui.getByLabelText('2026-10-01')).toBeTruthy();
  });

  it('기록을 못 받았으면(undefined) 점 라벨을 붙이지 않는다', async () => {
    const ui = await render(
      <FriendWeekStrip selected={TODAY} today={TODAY} onSelect={jest.fn()} />,
    );
    expect(ui.getByLabelText('2026-09-29')).toBeTruthy();
  });
});
