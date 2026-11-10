import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

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

describe('Calendar — 접히는 동안 선택 표시 (2026-11-04 원 튐)', () => {
  it('접힘이 멈추기 전엔 떠 있는 원 대신 선택 칸에 둥근 채움을 띄운다 — 칸은 줄과 같이 움직인다', async () => {
    // 테스트 환경엔 레이아웃이 없어 줄 높이를 모르므로 접힘이 시작 전(멈추지 않은) 상태로 남는다.
    const ui = await render(
      <Calendar value="2026-09-16" onSelect={jest.fn()} weekOf="2026-09-16" />,
    );
    const fill = ui.getByTestId('calendar-selected-fill-2026-09-16');
    // 모서리와 배경을 한 뷰가 처음부터 함께 가진다(Android 네모 회귀 방지).
    const style = StyleSheet.flatten(fill.props.style as StyleProp<ViewStyle>);
    expect(style.borderRadius).toBeGreaterThan(0);
    expect(style.backgroundColor).toBeTruthy();
    expect(ui.queryByTestId('calendar-selected-fill-2026-09-17')).toBeNull();
  });

  const fillOpacity = (ui: Awaited<ReturnType<typeof render>>, date: string) =>
    StyleSheet.flatten(
      ui.getByTestId(`calendar-selected-fill-${date}`).props.style as StyleProp<ViewStyle>,
    ).opacity;

  it('월 보기(멈춘 상태)에선 칸을 칠하지 않는다 — 떠 있는 원이 맡는다', async () => {
    const ui = await render(<Calendar value="2026-09-16" onSelect={jest.fn()} />);
    // 채움 뷰는 늘 마운트돼 있고 투명하다 (#1653 — 새로 마운트하면 Android가 움직이는 동안 안 그렸다).
    expect(fillOpacity(ui, '2026-09-16')).toBe(0);
  });
});

it('주 이동으로 남는 줄이 바뀌면 그 줄을 새로 그린다 — 접혀 있던 높이가 남지 않게 (#1603 리뷰)', async () => {
  const ui = await render(<Calendar value="2026-09-16" onSelect={jest.fn()} weekOf="2026-09-16" />);
  const before = ui.getByTestId('calendar-week-row-3', { includeHiddenElements: true });
  await ui.rerender(<Calendar value="2026-09-23" onSelect={jest.fn()} weekOf="2026-09-23" />);
  const after = ui.getByTestId('calendar-week-row-3');
  // 접힌 줄(숨김)이던 3번째 줄이 남는 줄이 되면서 다른 인스턴스로 바뀐다.
  expect(after).not.toBe(before);
  expect(after.props.accessibilityElementsHidden).toBe(false);
});

describe('Calendar — 접힌 주간 보기의 선택 원 자리 (2026-11-09 제보)', () => {
  const layout = (x: number, y: number, width: number, height: number) => ({
    nativeEvent: { layout: { x, y, width, height } },
  });
  const ROW_H = 50;
  const HEADER = 40;
  /**
   * 원의 세로 자리. 좌표는 Reanimated 공유 값이라(2026-11-10) jest 목에서는 다시 그려야 스타일에
   * 반영된다 — 같은 값으로 한 번 더 그린 뒤 읽는다(onSelect를 새로 줘 memo를 지나간다).
   */
  const circleY = async (
    ui: Awaited<ReturnType<typeof render>>,
    value: string,
    weekOf: string | null,
  ) => {
    // 두 번 — 첫 렌더의 이펙트가 값을 옮기고, 둘째 렌더가 그 값을 스타일로 읽는다.
    await ui.rerender(<Calendar value={value} onSelect={jest.fn()} weekOf={weekOf} />);
    await ui.rerender(<Calendar value={value} onSelect={jest.fn()} weekOf={weekOf} />);
    const circle = ui.getByTestId('calendar-selected-circle', { includeHiddenElements: true });
    const { transform } = StyleSheet.flatten(circle.props.style as StyleProp<ViewStyle>) as {
      transform: { translateY?: number }[];
    };
    return transform.find((t) => t.translateY != null)?.translateY as number;
  };

  it('남는 줄의 마지막 onLayout이 오지 않아도 원은 첫 줄 자리에 선다 — 월 보기 때의 줄 자리가 아니라', async () => {
    // 2026-11-19(목)는 11월의 세 번째 줄(15~21). 월 보기에선 그 줄의 y가 HEADER + 2 × ROW_H.
    const ui = await render(
      <Calendar value="2026-11-19" onSelect={jest.fn()} weekOf="2026-11-19" />,
    );
    const rows = [0, 1, 2, 3, 4].map((wi) =>
      ui.getByTestId(`calendar-week-row-${wi}`, { includeHiddenElements: true }),
    );
    // 줄들은 월 보기 자리만 보고하고(접힌 뒤의 onLayout은 오지 않음), 그 뒤 접힘이 끝난다.
    await act(async () => {
      rows.forEach((row, wi) =>
        fireEvent(row, 'layout', layout(0, HEADER + wi * ROW_H, 350, ROW_H)),
      );
    });
    await act(async () => {
      fireEvent(ui.getByLabelText(/^2026-11-19(,|$)/), 'layout', layout(200, 0, 50, ROW_H));
    });
    expect(await circleY(ui, '2026-11-19', '2026-11-19')).toBeLessThan(HEADER + ROW_H);
    const translateY = await circleY(ui, '2026-11-19', '2026-11-19');
    // 첫 줄 자리(HEADER) 기준 — 월 보기 자리(HEADER + 100)였다면 두 줄 아래에 떴다.
    expect(translateY).toBeLessThan(HEADER + ROW_H);
    expect(translateY).toBeGreaterThanOrEqual(HEADER - ROW_H);
  });

  it('다른 날짜를 눌러 들어와도 원은 누른 날짜의 줄에 선다 — 월 보기 자리로 가던 이동이 남지 않는다 (2026-11-10 제보)', async () => {
    // 월 보기에서 11/10(둘째 줄)이 선택돼 있다가 11/26(넷째 줄)을 누르면, 원은 먼저 11/26의
    // 월 보기 자리로 미끄러지기 시작하고 곧바로 달력이 접힌다. 접힘이 끝나면 첫 줄 자리여야 한다.
    const ui = await render(<Calendar value="2026-11-10" onSelect={jest.fn()} />);
    const fireLayouts = async () => {
      await act(async () => {
        [0, 1, 2, 3, 4].forEach((wi) =>
          fireEvent(
            ui.getByTestId(`calendar-week-row-${wi}`, { includeHiddenElements: true }),
            'layout',
            layout(0, HEADER + wi * ROW_H, 350, ROW_H),
          ),
        );
        fireEvent(ui.getByLabelText(/^2026-11-10(,|$)/), 'layout', layout(100, 0, 50, ROW_H));
        fireEvent(ui.getByLabelText(/^2026-11-26(,|$)/), 'layout', layout(200, 0, 50, ROW_H));
      });
    };
    await fireLayouts();
    // 날짜만 바뀐 렌더 — 원이 11/26의 월 보기 자리(넷째 줄)로 간다.
    expect(await circleY(ui, '2026-11-26', null)).toBeGreaterThanOrEqual(
      HEADER + 3 * ROW_H - ROW_H,
    );
    // 이어서 주간 보기로 접힌다(줄들은 월 보기 자리만 보고한 상태).
    const y = await circleY(ui, '2026-11-26', '2026-11-26');
    expect(y).toBeLessThan(HEADER + ROW_H);
    expect(y).toBeGreaterThanOrEqual(HEADER - ROW_H);
  });
});
