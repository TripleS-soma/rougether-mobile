import { act, fireEvent, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { Calendar } from '@/components/ui/calendar';

describe('Calendar', () => {
  /**
   * 할 일 있는 날 점 (#838) — 컴포넌트는 이게 무슨 뜻인지 모르고 표시만
   * 한다. 접근성 라벨로 단언하는 이유는 점이 색만 있는 View라 텍스트로
   * 잡히지 않기 때문이다.
   */
  /**
   * 맥에서 요일 '토'가 다음 줄로 밀리던 버그 (#845) — 요일 7칸과 날짜 42칸이
   * 한 flexWrap 컨테이너에 있고 칸 폭이 `100/7`%(무한소수)라, 물리 픽셀
   * 반올림 합이 컨테이너를 조금만 넘어도 7번째가 줄바꿈됐다.
   *
   * 줄바꿈 자체는 jest에서 못 재므로 **되돌아올 수 없는 구조**를 단언한다:
   * 주 단위로 줄이 나뉘고(7칸씩), 칸은 퍼센트가 아니라 flex를 쓴다.
   */
  it('요일·날짜가 주 단위 줄로 나뉘고 칸 폭에 퍼센트를 쓰지 않는다 (#845)', async () => {
    const { getByLabelText, getByTestId } = await render(
      <Calendar value="2026-08-16" today="2026-08-16" onSelect={() => {}} />,
    );

    const flatten = (style: unknown): Record<string, unknown> =>
      Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

    // 날짜 칸은 flex:1 — 퍼센트 폭이면 반올림 줄바꿈이 되돌아온다.
    const cell = flatten(getByLabelText('2026-08-16').props.style);
    expect(cell.flex).toBe(1);
    expect(typeof cell.width).not.toBe('string');

    // grid는 가로 wrap이 아니라 세로 스택이어야 한다.
    const grid = flatten(getByTestId('calendar-grid').props.style);
    expect(grid.flexWrap).toBeUndefined();
    expect(grid.flexDirection).toBe('column');
  });

  /**
   * 점이 흐름에 있으면 셀이 [숫자 + 점]을 통째로 중앙 정렬해 **숫자가 셀
   * 중앙보다 위로 올라가고**, 선택 원(셀 실측 중앙)과 어긋난다 — 맥에서
   * 실제로 그렇게 보였다 (#845 후속). 절대 배치를 고정한다.
   */
  it('할 일 점은 절대 배치라 날짜 숫자 위치를 밀지 않는다 (#845)', async () => {
    const { getByLabelText } = await render(
      <Calendar
        value="2026-08-16"
        today="2026-08-16"
        onSelect={() => {}}
        markedDates={new Set(['2026-08-20'])}
      />,
    );
    const flatten = (style: unknown): Record<string, unknown> =>
      Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

    const marked = getByLabelText('2026-08-20, 할 일 있음');
    const children = marked.children as unknown as { props?: { style?: unknown } }[];
    const dot = children.map((c) => flatten(c?.props?.style)).find((style) => style.bottom != null);

    expect(dot).toBeTruthy();
    expect(dot?.position).toBe('absolute');
  });

  it('markedDates에 든 날짜만 할 일 있음으로 표시한다', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <Calendar
        value="2026-08-16"
        today="2026-08-16"
        onSelect={() => {}}
        markedDates={new Set(['2026-08-20'])}
      />,
    );
    expect(getByLabelText('2026-08-20, 할 일 있음')).toBeTruthy();
    // 표시 안 된 날은 라벨이 날짜만 — 점 없는 상태.
    expect(getByLabelText('2026-08-21')).toBeTruthy();
    expect(queryByLabelText('2026-08-21, 할 일 있음')).toBeNull();
  });

  it('markedDates가 없으면 종전 그대로 — 날짜 선택 시트에 영향 없다', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <Calendar value="2026-08-16" today="2026-08-16" onSelect={() => {}} />,
    );
    expect(getByLabelText('2026-08-20')).toBeTruthy();
    expect(queryByLabelText(/할 일 있음/)).toBeNull();
  });

  it('보이는 달이 바뀌면 onVisibleMonthChange를 부른다 — 마운트 시 1회 포함', async () => {
    const onVisibleMonthChange = jest.fn();
    const { getByLabelText } = await render(
      <Calendar
        value="2026-08-16"
        today="2026-08-16"
        onSelect={() => {}}
        onVisibleMonthChange={onVisibleMonthChange}
      />,
    );
    expect(onVisibleMonthChange).toHaveBeenCalledWith('2026-08');

    await fireEvent.press(getByLabelText('이전 달'));
    expect(onVisibleMonthChange).toHaveBeenCalledWith('2026-07');
  });

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

  // 나의 방 달력 탭은 가로 스와이프가 방↔달력 순환이라 월 이동을 끈다 —
  // 플링이 부모 디텍터로 흘러가고 월은 ‹ › 버튼으로만 움직인다.
  it('monthSwipe=false면 그리드 플링이 월을 바꾸지 않는다', async () => {
    const { getByText } = await render(
      <Calendar value="2026-06-15" onSelect={() => {}} monthSwipe={false} />,
    );
    await act(async () =>
      fireGestureHandler(getByGestureTestId('calendar-month-fling'), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END, translationX: -60, translationY: 0 },
      ]),
    );
    expect(getByText('2026년 6월')).toBeTruthy();
  });

  /**
   * 되돌아가는 버튼이지 "여기가 오늘"이라는 배지가 아니다 (#864). 보이는
   * 글자가 명사 "오늘"이면 배지로 읽힌다 — 실제로 그렇게 읽혔고, #862로
   * 오늘 칸에 링이 생기면서 같은 단어를 말하는 게 둘이 돼 더 헷갈렸다.
   * 접근성 라벨은 예전부터 "오늘로"였으니 보이는 글자만 거짓말이었던 셈.
   */
  it('오늘로 가는 버튼은 동작형 문구를 보여준다 — 배지처럼 읽히지 않게 (#864)', async () => {
    const { getByText, queryByText } = await render(
      <Calendar value="2026-06-15" today="2026-07-24" onSelect={() => {}} />,
    );
    expect(getByText('오늘로')).toBeTruthy();
    // 명사 단독이면 상태 배지로 읽힌다.
    expect(queryByText('오늘')).toBeNull();
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

  /**
   * 오늘 표시 (#862) — 다른 날짜로 이동해도 오늘이 어디인지 보여야 한다.
   * 채움이 아니라 **테두리**다: primarySoft 채움은 배경과 ΔE 3~7이라 사실상
   * 안 보이고, 빈 원/꽉 찬 원으로 오늘과 선택의 뜻도 갈린다.
   */
  it('오늘이 아닌 날을 선택하면 오늘 칸에 테두리 원이 생긴다 (#862)', async () => {
    const { getByLabelText } = await render(
      <Calendar value="2026-08-20" today="2026-08-16" onSelect={() => {}} />,
    );
    const flatten = (style: unknown): Record<string, unknown> =>
      Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

    const todayCell = getByLabelText('2026-08-16, 오늘');
    const ring = (todayCell.children as unknown as { children?: unknown[] }[])
      .flatMap((c) => (c?.children ?? []) as { props?: { style?: unknown } }[])
      .map((c) => flatten(c?.props?.style))
      .find((st) => st.borderWidth != null);

    expect(ring).toBeTruthy();
    // 절대 배치라 날짜 숫자를 밀지 않는다 (#845에서 점으로 겪은 회귀).
    expect(ring?.position).toBe('absolute');
  });

  it('오늘을 선택 중이면 테두리를 겹쳐 그리지 않는다 (#862)', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <Calendar value="2026-08-16" today="2026-08-16" onSelect={() => {}} />,
    );
    // 선택 = 꽉 찬 원이므로 라벨에 '오늘'이 붙지 않는다.
    expect(queryByLabelText('2026-08-16, 오늘')).toBeNull();
    expect(getByLabelText('2026-08-16')).toBeTruthy();
  });

  it('today를 안 주면 어떤 칸에도 오늘 표시가 없다 (날짜 선택 시트)', async () => {
    const { queryByLabelText } = await render(<Calendar value="2026-08-20" onSelect={() => {}} />);
    expect(queryByLabelText(/오늘$/)).toBeNull();
  });

  it('오늘이면서 할 일도 있으면 둘 다 라벨에 담는다 (#862)', async () => {
    const { getByLabelText } = await render(
      <Calendar
        value="2026-08-20"
        today="2026-08-16"
        onSelect={() => {}}
        markedDates={new Set(['2026-08-16'])}
      />,
    );
    expect(getByLabelText('2026-08-16, 오늘, 할 일 있음')).toBeTruthy();
  });

  /**
   * 월말 날짜가 통째로 사라지던 버그 (#1008) — `weeks`가 `cells.length / 7`로
   * 주 수를 세는데 `Array.from`의 length가 **내림**돼, 7의 배수가 아닌 달은
   * 마지막 부분 주가 렌더되지 않았다. 2026년 12달 중 9달이 그랬고 7월은 6일이
   * 빠졌다. `blocks completion on future dates`(my-room-screen)가 8/29(토)에야
   * 처음 깨진 이유는 **오늘이 잘린 구간에 걸려야만** 드러났기 때문이다.
   *
   * 오늘 날짜에 의존하지 않게 `today`를 고정해 달마다 단언한다.
   */
  describe('마지막 주를 버리지 않는다 (#1008)', () => {
    // 2026년의 7의 배수가 아닌 달 — 앞 빈칸 + 일수가 35/42로 안 떨어진다.
    const CASES: [string, string, string][] = [
      ['2026-03', '2026-03-15', '2026-03-31'],
      ['2026-07', '2026-07-15', '2026-07-31'],
      ['2026-08', '2026-08-16', '2026-08-31'],
      ['2026-12', '2026-12-15', '2026-12-31'],
    ];
    it.each(CASES)('%s 달의 마지막 날이 렌더된다', async (_label, today, lastDay) => {
      const { getByLabelText } = await render(
        <Calendar value={today} today={today} onSelect={() => {}} />,
      );
      expect(getByLabelText(lastDay)).toBeTruthy();
    });

    it('그 달의 모든 날짜가 렌더된다 — 31일 달에서 31칸', async () => {
      const { queryAllByLabelText } = await render(
        <Calendar value="2026-08-16" today="2026-08-16" onSelect={() => {}} />,
      );
      expect(queryAllByLabelText(/^2026-08-\d{2}/)).toHaveLength(31);
    });
  });
});
