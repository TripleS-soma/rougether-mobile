import { fireEvent, render } from '@testing-library/react-native';

import { Calendar } from '@/components/ui/calendar';

describe('Calendar — 주 접힘 모드 (#1327)', () => {
  it('weekOf가 있으면 ‹ ›가 주 이동이 되고 onSelect에 ±7일과 source=week를 넘긴다', async () => {
    const onSelect = jest.fn();
    const ui = await render(
      <Calendar value="2026-09-16" onSelect={onSelect} weekOf="2026-09-16" />,
    );
    expect(ui.queryByLabelText('이전 달')).toBeNull();
    await fireEvent.press(ui.getByLabelText('다음 주'));
    expect(onSelect).toHaveBeenLastCalledWith('2026-09-23', 'week');
    await fireEvent.press(ui.getByLabelText('이전 주'));
    expect(onSelect).toHaveBeenLastCalledWith('2026-09-09', 'week');
  });

  it('달을 넘는 주 이동도 요일을 지킨다', async () => {
    const onSelect = jest.fn();
    const ui = await render(
      <Calendar value="2026-09-30" onSelect={onSelect} weekOf="2026-09-30" />,
    );
    await fireEvent.press(ui.getByLabelText('다음 주'));
    expect(onSelect).toHaveBeenLastCalledWith('2026-10-07', 'week');
  });

  it('접힌 동안 선택 주가 아닌 줄은 접근성 트리에서 숨긴다', async () => {
    const ui = await render(
      <Calendar value="2026-09-16" onSelect={jest.fn()} weekOf="2026-09-16" />,
    );
    // 2026-09-16(수)은 9월 그리드의 세 번째 줄(1일이 화요일). 남는 줄만 접근성 트리에 있다.
    expect(ui.getByTestId('calendar-week-row-2')).toBeTruthy();
    expect(ui.queryByTestId('calendar-week-row-0')).toBeNull();
    expect(ui.queryByTestId('calendar-week-row-3')).toBeNull();
    expect(
      ui.getByTestId('calendar-week-row-0', { includeHiddenElements: true }).props
        .accessibilityElementsHidden,
    ).toBe(true);
    // 펼치면 다시 보인다.
    await ui.rerender(<Calendar value="2026-09-16" onSelect={jest.fn()} weekOf={null} />);
    expect(ui.getByTestId('calendar-week-row-0')).toBeTruthy();
    expect(ui.getByLabelText('이전 달')).toBeTruthy();
  });

  it("'오늘로' 칩은 source=today로 알린다 — 호출부가 탭과 구분한다", async () => {
    const onSelect = jest.fn();
    const ui = await render(
      <Calendar value="2026-09-02" onSelect={onSelect} today="2026-09-16" weekOf="2026-09-02" />,
    );
    await fireEvent.press(ui.getByLabelText('오늘로'));
    expect(onSelect).toHaveBeenLastCalledWith('2026-09-16', 'today');
    await fireEvent.press(ui.getByLabelText(/^2026-09-02/));
    expect(onSelect).toHaveBeenLastCalledWith('2026-09-02');
  });

  it('달이 걸친 주는 이웃 달 날짜까지 7칸 다 보이고 누를 수 있다 (2026-10 제보)', async () => {
    const onSelect = jest.fn();
    // 10월 뷰에서 9/27~10/3 주 — 예전엔 1·2·3만 보였다.
    const ui = await render(
      <Calendar value="2026-10-02" onSelect={onSelect} weekOf="2026-10-02" />,
    );
    for (const d of [
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-03',
    ])
      expect(ui.getByLabelText(new RegExp(`^${d}(,|$)`))).toBeTruthy();
    await fireEvent.press(ui.getByLabelText(/^2026-09-29(,|$)/));
    expect(onSelect).toHaveBeenLastCalledWith('2026-09-29');
  });

  it('9월 뷰의 마지막 주도 10월 날짜까지 채운다', async () => {
    const ui = await render(
      <Calendar value="2026-09-30" onSelect={jest.fn()} weekOf="2026-09-30" />,
    );
    expect(ui.getByLabelText(/^2026-10-03(,|$)/)).toBeTruthy();
  });

  it('월 보기는 이웃 달 칸을 종전처럼 비운다', async () => {
    const ui = await render(<Calendar value="2026-10-02" onSelect={jest.fn()} />);
    expect(ui.queryByLabelText(/^2026-09-30(,|$)/)).toBeNull();
    expect(ui.getByLabelText(/^2026-10-01(,|$)/)).toBeTruthy();
  });
});
