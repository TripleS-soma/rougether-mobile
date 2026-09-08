import { fireEvent, render } from '@testing-library/react-native';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import { isoShift, pickCalendarDate, TODAY, YESTERDAY } from '@/test-utils/my-room-screen-fixtures';

describe('MyRoomScreen', () => {
  // 루틴 행 스와이프 삭제 (#566) — 액션은 항상 렌더되고 스와이프로 드러난다.
  // 풀스와이프 즉시 삭제가 아니라 액션 탭이 삭제 경로다.
  it('행 스와이프로 드러난 삭제 액션 탭 → onDeleteRoutine (#566)', async () => {
    const onDeleteRoutine = jest.fn();
    const { getByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onDeleteRoutine={onDeleteRoutine} />,
    );
    await fireEvent.press(getByLabelText('아침 7시 기상 스와이프 삭제'));
    expect(onDeleteRoutine).toHaveBeenCalledWith('1');
  });

  it('삭제 미배선 행은 스와이프 삭제가 비활성 (#566)', async () => {
    // onDeleteRoutine 없이 → 방탭 행에 스와이프 삭제 액션이 없다.
    const unwired = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} />);
    expect(unwired.queryByLabelText('아침 7시 기상 스와이프 삭제')).toBeNull();

    // 달력 탭 서버 기반(과거 기록) 항목도 스와이프 삭제 비활성.
    const calendarDays = {
      [YESTERDAY]: [
        { id: 'x9', kind: 'todo' as const, title: '지난 기록', completed: false, category: '' },
      ],
    };
    const server = await render(
      <MyRoomScreen
        routines={[]}
        calendarDays={calendarDays}
        onSelectDate={jest.fn()}
        onDeleteRoutine={jest.fn()}
      />,
    );
    await pickCalendarDate(server, YESTERDAY);
    expect(server.getByText('지난 기록')).toBeTruthy();
    expect(server.queryByLabelText('지난 기록 스와이프 삭제')).toBeNull();
  });

  // iOS/Fabric 뷰 재활용 + RNGH reactTag 어긋남 (#1207) — 행이 재마운트되지 않아야
  // 한다. 같은 루틴은 방 탭(오늘)·달력 클라이언트·달력 서버 어느 경로든 같은 키.
  it('행 키는 방 탭·달력(오늘)·달력(서버 날짜)에서 같다 (#1207)', async () => {
    const calendarDays = {
      [YESTERDAY]: [
        {
          id: '1',
          kind: 'routine' as const,
          title: '아침 7시 기상',
          completed: false,
          category: '건강',
        },
        { id: 'x9', kind: 'todo' as const, title: '지난 할 일', completed: false, category: '' },
      ],
    };
    const ui = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        calendarDays={calendarDays}
        onSelectDate={jest.fn()}
      />,
    );
    expect(ui.getByTestId('routine-row-routine-1')).toBeTruthy();

    // 달력 탭 · 오늘(클라이언트 경로) — 같은 키.
    await fireEvent.press(ui.getByText('달력'));
    expect(ui.getByTestId('routine-row-routine-1')).toBeTruthy();

    // 달력 탭 · 어제(서버 경로) — 여전히 같은 키, 투두는 kind 접두가 다르다.
    await pickCalendarDate(ui, YESTERDAY);
    expect(ui.getByTestId('routine-row-routine-1')).toBeTruthy();
    expect(ui.getByTestId('routine-row-todo-x9')).toBeTruthy();
  });

  it('완료 토글로 행이 아래로 가라앉아도 같은 노드가 남는다 — 재마운트 없음 (#1207)', async () => {
    const props = {
      routines: SAMPLE_ROUTINES,
      onDeleteRoutine: jest.fn(),
      onReorderRoutines: jest.fn(),
    };
    const ui = await render(<MyRoomScreen {...props} />);
    const before = ui.getByTestId('routine-row-routine-1');
    expect(ui.getByLabelText('아침 7시 기상 스와이프 삭제')).toBeTruthy();

    // 완료 → sinkDone으로 하단 이동 + draggable 해제. 키가 같으니 노드는 그대로.
    await ui.rerender(<MyRoomScreen {...props} completions={{ '1': [TODAY] }} />);
    expect(ui.getByTestId('routine-row-routine-1')).toBe(before);
    // 스와이프 삭제 액션도 그대로 살아 있다.
    await fireEvent.press(ui.getByLabelText('아침 7시 기상 스와이프 삭제'));
    expect(props.onDeleteRoutine).toHaveBeenCalledWith('1');
  });

  it('marks each category header with its visibility scope (#285)', async () => {
    const { getByLabelText, getAllByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} />,
    );
    // 데모 카테고리: 취미=이웃, 건강=일부, 나머지=전체 공개.
    expect(getByLabelText('이웃 공개')).toBeTruthy();
    expect(getByLabelText('일부 공개')).toBeTruthy();
    expect(getAllByLabelText('전체 공개').length).toBeGreaterThan(0);
  });

  it('hides the quick-add button for mission-linked categories (#272)', async () => {
    // 기본 카테고리 id는 라벨과 동일('일정' 등) — 일정을 미션 연동으로 지정.
    const { getByLabelText, queryByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} quickAddDisabledCategoryIds={['일정']} />,
    );
    expect(queryByLabelText('일정 할 일 추가')).toBeNull();
    expect(getByLabelText('건강 할 일 추가')).toBeTruthy();
  });

  it('keeps the quick-add button reachable on empty categories', async () => {
    // No routines at all — every category header (and its +) must still render.
    const { getByLabelText } = await render(<MyRoomScreen routines={[]} />);
    expect(getByLabelText('일정 할 일 추가')).toBeTruthy();
    expect(getByLabelText('취미 할 일 추가')).toBeTruthy();
  });

  it('schedules 격주/매월/매년 routines by their cadence (#255)', async () => {
    const [y, m, d] = TODAY.split('-').map(Number);
    const todayWd = new Date(y, m - 1, d).getDay();
    const weekAgo = isoShift(-7);
    const routines = [
      // Biweekly anchored this week → scheduled today; anchored last week → not.
      { id: '1', title: '이번주 격주', kind: 'routine' as const, repeat: 'biweekly' as const, days: [todayWd], startDate: TODAY }, // prettier-ignore
      { id: '2', title: '지난주 격주', kind: 'routine' as const, repeat: 'biweekly' as const, days: [todayWd], startDate: weekAgo }, // prettier-ignore
      // Monthly on today's day-of-month vs a different day.
      { id: '3', title: '오늘 매월', kind: 'routine' as const, repeat: 'monthly' as const, dayOfMonth: d }, // prettier-ignore
      { id: '4', title: '다른날 매월', kind: 'routine' as const, repeat: 'monthly' as const, dayOfMonth: d === 1 ? 2 : 1 }, // prettier-ignore
      // Yearly on today's month+day vs a different month.
      { id: '5', title: '오늘 매년', kind: 'routine' as const, repeat: 'yearly' as const, month: m, dayOfMonth: d }, // prettier-ignore
      { id: '6', title: '다른달 매년', kind: 'routine' as const, repeat: 'yearly' as const, month: m === 1 ? 2 : 1, dayOfMonth: d }, // prettier-ignore
    ];
    const { getByText, queryByText } = await render(<MyRoomScreen routines={routines} />);

    expect(getByText('이번주 격주')).toBeTruthy();
    expect(queryByText('지난주 격주')).toBeNull();
    expect(getByText('오늘 매월')).toBeTruthy();
    expect(queryByText('다른날 매월')).toBeNull();
    expect(getByText('오늘 매년')).toBeTruthy();
    expect(queryByText('다른달 매년')).toBeNull();
  });

  it('hides routines not scheduled today from the 방 tab (repeat days respected)', async () => {
    const todayWd = new Date().getDay();
    const otherWd = (todayWd + 1) % 7;
    const routines = [
      { id: '1', title: '오늘 루틴', kind: 'routine' as const, days: [todayWd] },
      { id: '2', title: '다른 요일 루틴', kind: 'routine' as const, days: [otherWd] },
      { id: '3', title: '매일 루틴', kind: 'routine' as const },
    ];
    const { getByText, queryByText } = await render(<MyRoomScreen routines={routines} />);

    expect(getByText('오늘 루틴')).toBeTruthy();
    expect(getByText('매일 루틴')).toBeTruthy();
    // Edited to a different weekday → must drop out of today's list.
    expect(queryByText('다른 요일 루틴')).toBeNull();
    expect(getByText('0 / 2')).toBeTruthy();
  });

  it('카테고리가 있어도 무소속 항목은 미분류 그룹으로 분리된다 — 방·달력 (#517)', async () => {
    const routines = [
      { id: '1', title: '물 마시기', category: '건강', kind: 'routine' as const },
      // 카테고리 삭제(UNASSIGN) 산물 — 마지막 카테고리에 섞이면 안 된다.
      { id: '2', title: '고아 루틴', kind: 'routine' as const },
    ];
    const categories = [
      {
        id: '건강',
        name: '건강',
        icon: 'dumbbell' as const,
        color: '#7FA87F',
        visibility: 'public' as const,
      },
    ];
    const { getByText } = await render(
      <MyRoomScreen routines={routines} categories={categories} />,
    );
    // 방 탭: 건강 그룹과 별개의 미분류 그룹.
    expect(getByText('건강')).toBeTruthy();
    expect(getByText('미분류')).toBeTruthy();
    expect(getByText('고아 루틴')).toBeTruthy();

    // 달력 탭에서도 같은 분리 규칙.
    await fireEvent.press(getByText('달력'));
    expect(getByText('미분류')).toBeTruthy();
    expect(getByText('고아 루틴')).toBeTruthy();
  });

  it('카테고리 헤더 탭 → 프리필된 수정 시트, 저장 시 onUpdateCategory (#541)', async () => {
    const onUpdateCategory = jest.fn();
    const routines = [{ id: '1', title: '물 마시기', category: '건강', kind: 'routine' as const }];
    const categories = [
      {
        id: '건강',
        name: '건강',
        icon: 'dumbbell' as const,
        color: '#7FA87F',
        visibility: 'public' as const,
      },
    ];
    const { getByLabelText, getByDisplayValue } = await render(
      <MyRoomScreen
        routines={routines}
        categories={categories}
        onUpdateCategory={onUpdateCategory}
      />,
    );

    await fireEvent.press(getByLabelText('건강 카테고리 수정'));
    // 시트가 기존 이름으로 프리필된다.
    await fireEvent.changeText(getByDisplayValue('건강'), '몸 관리');
    await fireEvent.press(getByLabelText('카테고리 저장'));
    expect(onUpdateCategory).toHaveBeenCalledWith(
      '건강',
      expect.objectContaining({ name: '몸 관리' }),
    );
  });

  it('미분류 헤더는 수정 진입이 없다 (#541)', async () => {
    const onUpdateCategory = jest.fn();
    const routines = [{ id: '2', title: '고아 루틴', kind: 'routine' as const }];
    const { getByLabelText } = await render(
      <MyRoomScreen routines={routines} categories={[]} onUpdateCategory={onUpdateCategory} />,
    );
    // Pressable은 렌더되지만 disabled — 눌러도 시트가 열리지 않는다.
    const header = getByLabelText('미분류 카테고리 수정');
    expect(header.props.accessibilityState?.disabled).toBe(true);
  });

  it('반복 루틴에만 ↻ 마커가 붙는다 — 투두는 무마커 (#576)', async () => {
    const rows = [
      { id: 'r1', title: '반복 루틴', category: '건강', kind: 'routine' as const },
      { id: 't1', title: '일회성 투두', category: '건강', kind: 'todo' as const, dueDate: TODAY },
    ];
    const categories = [
      {
        id: '건강',
        name: '건강',
        icon: 'dumbbell' as const,
        color: '#7FA87F',
        visibility: 'public' as const,
      },
    ];
    const { getAllByTestId } = await render(
      <MyRoomScreen routines={rows} categories={categories} />,
    );
    expect(getAllByTestId('repeat-marker')).toHaveLength(1);
  });

  it('renders uncategorized routines even when the user has no categories', async () => {
    // API state after a fresh account adds routines without a category:
    // categories = [], routines have no category → must show in a 미분류 group,
    // not vanish while the counter says 0 / 2.
    const routines = [
      { id: '2', title: '아침 기상', kind: 'routine' as const },
      { id: '3', title: '독서 30분', kind: 'routine' as const },
    ];
    const { getByText } = await render(<MyRoomScreen routines={routines} categories={[]} />);
    expect(getByText('아침 기상')).toBeTruthy();
    expect(getByText('독서 30분')).toBeTruthy();
    expect(getByText('미분류')).toBeTruthy();
    expect(getByText('0 / 2')).toBeTruthy();
  });

  it('sinks checked routines below unchecked ones within their category', async () => {
    const routines = [
      { id: '1', title: '완료된 루틴', kind: 'routine' as const, category: '건강' },
      { id: '2', title: '미완료 루틴', kind: 'routine' as const, category: '건강' },
      { id: '3', title: '나중 완료 루틴', kind: 'routine' as const, category: '건강' },
    ];
    // Ids 1 and 3 are done today — both must render below the unchecked one,
    // keeping their relative order.
    const { getAllByRole } = await render(
      <MyRoomScreen routines={routines} completions={{ '1': [TODAY], '3': [TODAY] }} />,
    );
    const labels = getAllByRole('checkbox').map((el) => el.props.accessibilityLabel);
    expect(labels).toEqual(['미완료 루틴', '완료된 루틴', '나중 완료 루틴']);
  });

  it('shows a loading state, an error state with retry, and an empty state', async () => {
    const loading = await render(<MyRoomScreen loading />);
    expect(loading.getByText('불러오는 중...')).toBeTruthy();

    const onRetry = jest.fn();
    const failed = await render(<MyRoomScreen loadError onRetry={onRetry} />);
    await fireEvent.press(failed.getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Brand-new user (#626): 안내 문구 없이 미분류 그룹이 떠서 바로 추가를 시작한다.
    const onQuickAddRoutine = jest.fn();
    const empty = await render(
      <MyRoomScreen routines={[]} categories={[]} onQuickAddRoutine={onQuickAddRoutine} />,
    );
    expect(empty.getByText('미분류')).toBeTruthy();
    // 미분류 퀵애드가 열리고(빈 계정 예외), categoryId 없이 제출된다.
    await fireEvent.press(empty.getByLabelText('미분류 할 일 추가'));
    await fireEvent.changeText(empty.getByPlaceholderText('할 일 입력 후 완료'), '물 마시기');
    await fireEvent(empty.getByPlaceholderText('할 일 입력 후 완료'), 'blur');
    expect(onQuickAddRoutine).toHaveBeenCalledWith('', '물 마시기', expect.any(String));
  });

  // 인증사진형 잠시 내림 (#499) — PHOTO 루틴도 카메라 없이 일반 체크로 완료된다.
  // 복구 시 아래 주석의 카메라 게이트 테스트를 되살릴 것.
  it('completes a 인증사진형 routine without the camera while shelved (#499)', async () => {
    const onToggleCompletion = jest.fn();
    const { getByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onToggleCompletion={onToggleCompletion} />,
    );

    // '영어 공부' (id 4): 예전 사진 인증형(#695 제거)도 즉시 완료 토글.
    fireEvent.press(getByLabelText('영어 공부'));
    expect(onToggleCompletion).toHaveBeenCalledWith('4', TODAY);
  });

  it('방 탭 미완료 루틴을 routineOrder 순서로 그린다 (#716)', async () => {
    const routines = [
      { id: 'a', title: '작업 에이', category: '건강', kind: 'routine' as const },
      { id: 'b', title: '작업 비', category: '건강', kind: 'routine' as const },
    ];
    const categories = [
      {
        id: '건강',
        name: '건강',
        icon: 'dumbbell' as const,
        color: '#7FA87F',
        visibility: 'public' as const,
      },
    ];
    const { getAllByText } = await render(
      <MyRoomScreen
        routines={routines}
        categories={categories}
        routineOrder={{ 건강: ['b', 'a'] }}
        onReorderRoutines={jest.fn()}
        onMoveRoutineCategory={jest.fn()}
      />,
    );
    // 저장된 순서(b→a)대로 렌더 — '작업 비'가 '작업 에이'보다 먼저.
    const titles = getAllByText(/작업 (에이|비)/).map((n) => n.props.children);
    expect(titles).toEqual(['작업 비', '작업 에이']);
  });
});
