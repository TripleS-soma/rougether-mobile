import { act, fireEvent, render } from '@testing-library/react-native';
import { type PanGesture, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { ROUTINE_CATEGORIES } from '@/constants/routines';
import { pickCalendarDate, YESTERDAY } from '@/test-utils/my-room-screen-fixtures';

/**
 * 카테고리 헤더 롱프레스 드래그 (2026-09-08) — 그룹(헤더+행)이 통째로 움직이고,
 * 놓으면 onReorderCategories(전체 카테고리 id 순서). 미분류('')는 꼬리 고정.
 * 그룹 위치는 onLayout(부모 기준)으로 재므로 테스트가 layout 이벤트를 직접 쏜다.
 */
const GROUP_H = 100;
/** 그룹들을 위→아래 100px 간격으로 놓는다 (id '' = 미분류는 'uncat' testID). */
const layoutGroups = async (
  ui: Pick<Awaited<ReturnType<typeof render>>, 'getByTestId'>,
  ids: string[],
  height = GROUP_H,
) => {
  for (const [i, id] of ids.entries()) {
    await fireEvent(ui.getByTestId(`category-group-${id || 'uncat'}`), 'layout', {
      nativeEvent: { layout: { x: 0, y: i * height, width: 300, height } },
    });
  }
};

/** 헤더를 꾹 눌러 translationY만큼 끌고 놓는다 — activateAfterLongPress는 jest-utils가 건너뛴다. */
const dragCategory = (id: string, translationY: number) =>
  act(async () =>
    fireGestureHandler(getByGestureTestId(`category-drag-${id || 'uncat'}`), [
      { state: State.BEGAN },
      { state: State.ACTIVE, translationY: 0 },
      { state: State.ACTIVE, translationY },
      { state: State.END, translationY },
    ]),
  );

const routines = [
  { id: 'r1', title: '일정 루틴', category: '일정', kind: 'routine' as const },
  { id: 'r2', title: '무소속 루틴', category: '', kind: 'routine' as const },
];
// 기본 카테고리 5개 + 미분류 꼬리.
const IDS = [...ROUTINE_CATEGORIES.map((c) => c.id), ''];

describe('카테고리 헤더 롱프레스 드래그 (2026-09-08)', () => {
  it('헤더를 끌어 놓으면 onReorderCategories에 전체 카테고리 id의 새 순서 (미분류 제외)', async () => {
    const onReorderCategories = jest.fn();
    const ui = await render(
      <MyRoomScreen
        routines={routines}
        onReorderRoutines={jest.fn()}
        onReorderCategories={onReorderCategories}
      />,
    );
    expect(ui.getByText('미분류')).toBeTruthy();
    await layoutGroups(ui, IDS);

    // 일정(0~100, 중심 50)을 150 내리면 중심 200 — 공부 중심(150)을 넘고 취미(250)는 못 넘는다.
    await dragCategory('일정', 150);
    expect(onReorderCategories).toHaveBeenCalledTimes(1);
    expect(onReorderCategories).toHaveBeenCalledWith(['공부', '일정', '취미', '건강', '기타']);
  });

  it('제자리에 놓으면 저장하지 않는다', async () => {
    const onReorderCategories = jest.fn();
    const ui = await render(
      <MyRoomScreen routines={routines} onReorderCategories={onReorderCategories} />,
    );
    await layoutGroups(ui, IDS);
    await dragCategory('취미', 30);
    expect(onReorderCategories).not.toHaveBeenCalled();
  });

  it('미분류는 끌 수 없고, 어떤 카테고리도 미분류 아래로는 못 간다', async () => {
    const onReorderCategories = jest.fn();
    const ui = await render(
      <MyRoomScreen routines={routines} onReorderCategories={onReorderCategories} />,
    );
    await layoutGroups(ui, IDS);
    // 미분류 헤더의 팬은 붙어 있되 꺼져 있다 — 트리 모양은 다른 그룹과 같다.
    expect(getByGestureTestId('category-drag-uncat').config.enabled).toBe(false);
    expect(getByGestureTestId('category-drag-일정').config.enabled).toBe(true);

    // 마지막 실제 카테고리(기타)를 미분류 아래(1000px)로 — 순서 그대로라 저장 없음.
    await dragCategory('기타', 1000);
    expect(onReorderCategories).not.toHaveBeenCalled();

    // 건강을 미분류 아래로 — 미분류 바로 위(실제 카테고리 끝)에 멈춘다.
    await dragCategory('건강', 1000);
    expect(onReorderCategories).toHaveBeenCalledWith(['일정', '공부', '취미', '기타', '건강']);
  });

  it('onReorderCategories가 없으면 헤더 드래그는 꺼져 있다', async () => {
    await render(<MyRoomScreen routines={routines} onReorderRoutines={jest.fn()} />);
    expect(getByGestureTestId('category-drag-일정').config.enabled).toBe(false);
  });

  it('카테고리 드래그 중엔 행 드래그가 꺼지고, 행 드래그 중엔 헤더 드래그가 꺼진다', async () => {
    await render(
      <MyRoomScreen
        routines={routines}
        onReorderRoutines={jest.fn()}
        onReorderCategories={jest.fn()}
      />,
    );
    const header = getByGestureTestId('category-drag-일정') as PanGesture;
    const row = getByGestureTestId('routine-drag-routine-r1') as PanGesture;
    expect(row.config.enabled).toBe(true);
    expect(header.config.enabled).toBe(true);

    // fireGestureHandler는 END를 덧붙이므로 활성 구간은 핸들러를 직접 부른다.
    type StartEvent = Parameters<NonNullable<PanGesture['handlers']['onStart']>>[0];
    await act(async () => header.handlers.onStart?.({} as StartEvent));
    expect(getByGestureTestId('routine-drag-routine-r1').config.enabled).toBe(false);
    await act(async () => {
      header.handlers.onEnd?.({} as StartEvent, true);
      header.handlers.onFinalize?.({} as StartEvent, true);
    });
    expect(getByGestureTestId('routine-drag-routine-r1').config.enabled).toBe(true);

    // 반대 방향.
    await act(async () => row.handlers.onStart?.({} as StartEvent));
    expect(getByGestureTestId('category-drag-일정').config.enabled).toBe(false);
    await act(async () => {
      row.handlers.onEnd?.({} as StartEvent, true);
      row.handlers.onFinalize?.({} as StartEvent, true);
    });
    expect(getByGestureTestId('category-drag-일정').config.enabled).toBe(true);
  });

  it('달력 서버 날짜 — 안 그려진 카테고리는 제자리를 지키고 보이는 것끼리만 바뀐다', async () => {
    const onReorderCategories = jest.fn();
    const categories = ['A', 'B', 'C'].map((id) => ({
      id,
      name: id,
      icon: 'sparkle' as const,
      color: '#7FA87F',
      visibility: 'public' as const,
    }));
    const calendarDays = {
      [YESTERDAY]: [
        { id: 'x', kind: 'todo' as const, title: 'A의 일', completed: false, category: 'A' },
        { id: 'y', kind: 'todo' as const, title: 'C의 일', completed: false, category: 'C' },
      ],
    };
    const ui = await render(
      <MyRoomScreen
        routines={[]}
        categories={categories}
        calendarDays={calendarDays}
        onSelectDate={jest.fn()}
        // B는 그 날 항목이 없고 퀵애드도 막혀 헤더가 안 그려진다.
        quickAddDisabledCategoryIds={['B']}
        onReorderCategories={onReorderCategories}
      />,
    );
    await pickCalendarDate(ui, YESTERDAY);
    expect(ui.queryByTestId('category-group-B')).toBeNull();
    await layoutGroups(ui, ['A', 'C']);

    // C(100~200)를 A 위로 → 보이는 순서 [C, A], 전체엔 B가 제자리: [C, B, A].
    await dragCategory('C', -150);
    expect(onReorderCategories).toHaveBeenCalledWith(['C', 'B', 'A']);
  });
});
