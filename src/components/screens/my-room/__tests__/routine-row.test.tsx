import { fireEvent, render } from '@testing-library/react-native';
import { Animated } from 'react-native';

import { QuickAddRow } from '@/components/screens/my-room/quick-add-row';
import { RoutineRow } from '@/components/screens/my-room/routine-row';

const noop = () => {};
const rowProps = {
  rowKey: 'r1',
  title: '물 1L 마시기',
  done: false,
  color: '#7FA87F',
  draggable: false,
  active: false,
  dragTY: new Animated.Value(0),
  menuEnabled: true,
  deleteEnabled: true,
  onToggle: noop,
  onMenu: noop,
  onDelete: noop,
  onDragStart: noop,
  onDragUpdate: noop,
  onDragEnd: noop,
  onDragFinalize: noop,
  registerRef: noop,
};

describe('RoutineRow (#769)', () => {
  it('memo 컴포넌트다 — 렌더 함수였을 땐 memo 경계 자체가 없었다', () => {
    expect((RoutineRow as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
  });

  it('콜백을 rowKey로 디스패치한다 — 부모가 참조를 고정할 수 있게', async () => {
    const onToggle = jest.fn();
    const onMenu = jest.fn();
    const { getByLabelText } = await render(
      <RoutineRow {...rowProps} onToggle={onToggle} onMenu={onMenu} />,
    );

    await fireEvent.press(getByLabelText('물 1L 마시기'));
    expect(onToggle).toHaveBeenCalledWith('r1', expect.anything());

    await fireEvent.press(getByLabelText('물 1L 마시기 메뉴'));
    expect(onMenu).toHaveBeenCalledWith('r1');
  });

  it('메뉴가 비활성이면 본문 탭이 아무것도 열지 않는다 (기록만 남은 항목)', async () => {
    const onMenu = jest.fn();
    const { getByLabelText } = await render(
      <RoutineRow {...rowProps} menuEnabled={false} onMenu={onMenu} />,
    );
    await fireEvent.press(getByLabelText('물 1L 마시기 메뉴'));
    expect(onMenu).not.toHaveBeenCalled();
  });

  it('반복 마커와 시각 배지는 값이 있을 때만 (#576)', async () => {
    const plain = await render(<RoutineRow {...rowProps} />);
    expect(plain.queryByTestId('repeat-marker')).toBeNull();

    const rich = await render(<RoutineRow {...rowProps} repeats time="07:00" />);
    expect(rich.getByTestId('repeat-marker')).toBeTruthy();
    expect(rich.getByText('오전 7:00')).toBeTruthy();
  });
});

describe('QuickAddRow (#769)', () => {
  it('입력 중인 제목을 스스로 소유한다 — 타이핑이 부모로 새지 않는다', async () => {
    const onCommit = jest.fn();
    const { getByPlaceholderText } = await render(
      <QuickAddRow
        dateLabel="오늘"
        onCommit={onCommit}
        onOpenDatePicker={noop}
        onDatePickerPressIn={noop}
      />,
    );

    const input = getByPlaceholderText('할 일 입력 후 완료');
    await fireEvent.changeText(input, '물');
    await fireEvent.changeText(input, '물 마시기');
    // 타건마다 부모를 부르면 화면 전체가 리렌더된다 — 커밋은 blur에서 한 번.
    expect(onCommit).not.toHaveBeenCalled();

    await fireEvent(input, 'blur');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('물 마시기');
  });

  it('날짜 칩은 press-in으로 먼저 알린 뒤 피커를 연다 — blur가 행을 닫지 않게', async () => {
    const order: string[] = [];
    const { getByLabelText } = await render(
      <QuickAddRow
        dateLabel="오늘"
        onCommit={noop}
        onOpenDatePicker={() => order.push('open')}
        onDatePickerPressIn={() => order.push('pressIn')}
      />,
    );

    const chip = getByLabelText('할 일 날짜 선택');
    await fireEvent(chip, 'pressIn');
    await fireEvent.press(chip);
    expect(order).toEqual(['pressIn', 'open']);
  });
});
