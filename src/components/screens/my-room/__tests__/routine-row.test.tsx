import { fireEvent, render } from '@testing-library/react-native';
import { Animated, Platform, Text } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { TabPager } from '@/components/app/tab-pager';
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

/** ReanimatedSwipeable 내부 팬 — dragOffset 기본값(±10)으로 행 드래그 팬과 구분한다. */
const swipeablePans = (panFactory: jest.SpyInstance) =>
  panFactory.mock.results
    .map(({ value }) => value)
    .filter((g) => g.config.activeOffsetXStart === -10 && g.config.activeOffsetXEnd === 10);
/**
 * 실제로 GestureDetector에 붙은(handlerTag 발급) Swipeable 팬. 리렌더로 팬 객체가
 * 다시 만들어져도 같은 네이티브 핸들러(태그)를 이어받으므로, **서로 다른 태그 수 =
 * 마운트된 Swipeable 수**다 — 재마운트됐다면 새 태그가 생긴다.
 */
const mountedSwipeables = (panFactory: jest.SpyInstance) => {
  const byTag = new Map<number, { config: Record<string, unknown> }>();
  for (const g of swipeablePans(panFactory)) if (g.handlerTag > 0) byTag.set(g.handlerTag, g);
  return [...byTag.values()];
};

describe('RoutineRow 트리 모양 고정 (#1207)', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('완료 토글로 draggable이 꺼져도 루트 노드가 같다 — 재마운트 없음', async () => {
    const panFactory = jest.spyOn(Gesture, 'Pan');
    const ui = await render(<RoutineRow {...rowProps} draggable done={false} />);
    const before = ui.getByTestId('routine-row-r1');
    // 드래그 GestureDetector(testId로 조회)와 Swipeable이 둘 다 마운트돼 있다.
    expect(getByGestureTestId('routine-drag-r1').config.enabled).toBe(true);
    expect(mountedSwipeables(panFactory)).toHaveLength(1);

    // 화면이 완료 토글에 내리는 것과 같은 조합: done=true, draggable=false (sinkDone).
    await ui.rerender(<RoutineRow {...rowProps} draggable={false} done />);
    expect(ui.getByTestId('routine-row-r1')).toBe(before);
    expect(mountedSwipeables(panFactory)).toHaveLength(1);
    // 드래그는 제스처 자체가 아니라 enabled 플래그로만 꺼진다 — 디텍터는 그대로.
    expect(getByGestureTestId('routine-drag-r1').config.enabled).toBe(false);
  });

  it('draggable=false여도 GestureDetector가 탭·삭제 액션을 삼키지 않는다', async () => {
    const onToggle = jest.fn();
    const onDelete = jest.fn();
    const { getByLabelText } = await render(
      <RoutineRow {...rowProps} draggable={false} onToggle={onToggle} onDelete={onDelete} />,
    );
    expect(getByGestureTestId('routine-drag-r1').config.enabled).toBe(false);
    await fireEvent.press(getByLabelText('물 1L 마시기'));
    expect(onToggle).toHaveBeenCalledWith('r1', expect.anything());
    await fireEvent.press(getByLabelText('물 1L 마시기 스와이프 삭제'));
    expect(onDelete).toHaveBeenCalledWith('r1');
  });

  it('삭제 미배선 행도 Swipeable 안에 있지만 삭제를 드러낼 수 없다', async () => {
    const panFactory = jest.spyOn(Gesture, 'Pan');
    const ui = await render(<RoutineRow {...rowProps} deleteEnabled={false} />);
    expect(ui.queryByLabelText('물 1L 마시기 스와이프 삭제')).toBeNull();
    const mounted = mountedSwipeables(panFactory);
    expect(mounted).toHaveLength(1);
    expect(mounted[0].config.enabled).toBe(false);

    // 삭제가 배선되면 같은 트리에서 팬만 켜진다.
    await ui.rerender(<RoutineRow {...rowProps} deleteEnabled />);
    expect(ui.getByLabelText('물 1L 마시기 스와이프 삭제')).toBeTruthy();
    expect(mountedSwipeables(panFactory)).toHaveLength(1);
    expect(mountedSwipeables(panFactory)[0].config.enabled).not.toBe(false);
  });

  it('iOS 페이저 안에서는 페이저가 행 스와이프 팬의 실패를 기다린다 (blocksExternalGesture)', async () => {
    Platform.OS = 'ios';
    const panFactory = jest.spyOn(Gesture, 'Pan');
    await render(
      <TabPager index={0} onIndexChange={jest.fn()}>
        <RoutineRow {...rowProps} />
        <Text>이웃</Text>
      </TabPager>,
    );
    const pager = getByGestureTestId('tab-pager-pan');
    const mounted = mountedSwipeables(panFactory);
    expect(mounted).toHaveLength(1);
    expect(mounted[0].config.blocksHandlers).toContain(pager.handlerTag);
    // 스크롤과 달리 페이저 실패를 기다리지는 않는다 — 기다리면 가로 스와이프가 영영 안 잡힌다.
    expect(mounted[0].config.requireToFail ?? []).toEqual([]);
  });

  it('페이저 컨텍스트가 없으면(단독 화면·Android) 관계 없이 그대로 동작한다', async () => {
    Platform.OS = 'android';
    const panFactory = jest.spyOn(Gesture, 'Pan');
    const { getByLabelText } = await render(
      <TabPager index={0} onIndexChange={jest.fn()}>
        <RoutineRow {...rowProps} />
        <Text>이웃</Text>
      </TabPager>,
    );
    const mounted = mountedSwipeables(panFactory);
    expect(mounted).toHaveLength(1);
    expect(mounted[0].config.blocksHandlers ?? []).toEqual([]);
    expect(getByLabelText('물 1L 마시기 스와이프 삭제')).toBeTruthy();
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
