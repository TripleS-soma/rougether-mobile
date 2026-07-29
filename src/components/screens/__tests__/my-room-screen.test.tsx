import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { ToastProvider } from '@/components/ui/toast';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import { todayIso } from '@/utils/datetime';

const TODAY = todayIso();
// A non-today date guaranteed to sit in the calendar's current month view:
// the 1st, or the 2nd when today is the 1st.
const OTHER_DAY = `${TODAY.slice(0, 8)}${TODAY.endsWith('01') ? '02' : '01'}`;

/** TODAY shifted by n days (local), "YYYY-MM-DD". */
const isoShift = (days: number) => {
  const [y, m, d] = TODAY.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
};
const YESTERDAY = isoShift(-1);
const TOMORROW = isoShift(1);

/** Open the 달력 tab and select a date, hopping months when needed. */
const pickCalendarDate = async (
  ui: { getByText: (t: string) => any; getByLabelText: (t: string) => any },
  date: string,
) => {
  await fireEvent.press(ui.getByText('달력'));
  if (date.slice(0, 7) < TODAY.slice(0, 7)) await fireEvent.press(ui.getByLabelText('이전 달'));
  if (date.slice(0, 7) > TODAY.slice(0, 7)) await fireEvent.press(ui.getByLabelText('다음 달'));
  await fireEvent.press(ui.getByLabelText(date));
};

describe('MyRoomScreen', () => {
  it('renders the room title, streak, and today progress', async () => {
    // Completion is per date: mark 3 of the 5 routines done today.
    const completions = { '1': [TODAY], '2': [TODAY], '3': [TODAY] };
    const { getByText } = await render(
      <MyRoomScreen
        userName="준서"
        streakDays={7}
        routines={SAMPLE_ROUTINES}
        completions={completions}
      />,
    );
    expect(getByText('준서의 방')).toBeTruthy();
    expect(getByText('7일')).toBeTruthy();
    // 3 of 5 routines completed today.
    expect(getByText('3 / 5')).toBeTruthy();
  });

  it('헤더에 코인·다이아 필을 함께 보여준다 (프로필 아바타 제거로 확보한 자리)', async () => {
    const { getByText } = await render(
      <MyRoomScreen
        userName="준서"
        routines={SAMPLE_ROUTINES}
        coinBalance={1200}
        diamondBalance={34}
      />,
    );
    // 아바타를 빼고 다이아를 상시 노출 — 좁은 폭 코인-only(#425)를 되돌림.
    expect(getByText('준서의 방')).toBeTruthy();
    expect(getByText('1,200')).toBeTruthy();
    expect(getByText('34')).toBeTruthy();
  });

  it('행 메뉴 → 루틴 수정을 누르면 그 루틴으로 onEditRoutine을 부른다 (#465)', async () => {
    const onEditRoutine = jest.fn();
    const { getByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onEditRoutine={onEditRoutine} />,
    );
    // 행 본문 탭 → 메뉴 시트, 거기서 '루틴 수정' → 편집 진입 콜백.
    await fireEvent.press(getByLabelText('아침 7시 기상 메뉴'));
    await fireEvent.press(getByLabelText('아침 7시 기상 루틴 수정'));
    expect(onEditRoutine).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  // 방↔달력 스와이프 전환 (#561) — 콘텐츠 영역의 가로 우세 플링으로 탭 전환.
  // RNGH pan을 jest-utils로 구동한다 (활성/실패 임계·플링 판정 자체는
  // utils/gesture 단위 테스트가 검증).
  it('콘텐츠 영역 가로 플링으로 방↔달력 탭이 전환된다 (#561)', async () => {
    const ui = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} />);
    const fling = (translationX: number) =>
      act(async () =>
        fireGestureHandler(getByGestureTestId('room-tab-fling'), [
          { state: State.BEGAN },
          { state: State.ACTIVE },
          { state: State.END, translationX, translationY: 0 },
        ]),
      );

    // 왼쪽 플링 → 달력 탭.
    await fling(-60);
    expect(ui.getByText('이 날의 루틴')).toBeTruthy();
    // 오른쪽 플링 → 방 탭 복귀.
    await fling(60);
    expect(ui.getByText('오늘의 루틴')).toBeTruthy();
    // 임계 미달 릴리즈는 무시.
    await fling(-30);
    expect(ui.getByText('오늘의 루틴')).toBeTruthy();
  });

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

  it('marks each category header with its visibility scope (#285)', async () => {
    const { getByLabelText, getAllByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} />,
    );
    // 데모 카테고리: 취미=이웃, 건강=일부, 나머지=전체 공개.
    expect(getByLabelText('이웃 공개')).toBeTruthy();
    expect(getByLabelText('일부 공개')).toBeTruthy();
    expect(getAllByLabelText('전체 공개').length).toBeGreaterThan(0);
  });

  it('keeps the 의 방 suffix visible on narrow screens (shrink + middle ellipsis)', async () => {
    const { getByText } = await render(<MyRoomScreen userName="김철수베리롱네임" routines={[]} />);
    const title = getByText('김철수베리롱네임의 방');
    // Shrinks the font first, then ellipsizes the middle — never the suffix.
    expect(title.props.adjustsFontSizeToFit).toBe(true);
    expect(title.props.minimumFontScale).toBe(0.75);
    expect(title.props.ellipsizeMode).toBe('middle');
    expect(title.props.numberOfLines).toBe(1);
  });

  it('hides the streak badge when the streak is 0', async () => {
    const { queryByText } = await render(<MyRoomScreen streakDays={0} routines={[]} />);
    expect(queryByText('0일')).toBeNull();
  });

  it('hides the quick-add button for mission-linked categories (#272)', async () => {
    // 기본 카테고리 id는 라벨과 동일('일정' 등) — 일정을 미션 연동으로 지정.
    const { getByLabelText, queryByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} quickAddDisabledCategoryIds={['일정']} />,
    );
    expect(queryByLabelText('일정 할 일 추가')).toBeNull();
    expect(getByLabelText('건강 할 일 추가')).toBeTruthy();
  });

  it('toggles only via the checkbox; the row body opens the menu sheet', async () => {
    const onToggleCompletion = jest.fn();
    const { getByText, getByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onToggleCompletion={onToggleCompletion} />,
    );

    // Per-category quick-add todo button still renders.
    expect(getByLabelText('일정 할 일 추가')).toBeTruthy();
    expect(getByLabelText('건강 할 일 추가')).toBeTruthy();

    // The checkbox (labelled by the routine title) toggles completion.
    await fireEvent.press(getByLabelText('하루 회고'));
    expect(onToggleCompletion).toHaveBeenCalledWith('5', TODAY);

    // The row body (title text) opens the bottom-sheet menu, no extra toggle.
    await fireEvent.press(getByText('하루 회고'));
    expect(getByText('이름 변경')).toBeTruthy();
    expect(getByText('삭제하기')).toBeTruthy();
    expect(onToggleCompletion).toHaveBeenCalledTimes(1);
  });

  it('changes a todo due date via 날짜 바꾸기 (draft until 확인)', async () => {
    const onUpdateTodoDueDate = jest.fn();
    const todos = [
      { id: 't9', title: '장보기', kind: 'todo' as const, dueDate: TODAY, category: '건강' },
    ];
    const { getByText, getByLabelText, queryByText } = await render(
      <MyRoomScreen routines={todos} onUpdateTodoDueDate={onUpdateTodoDueDate} />,
    );

    await fireEvent.press(getByText('장보기')); // row body → menu sheet
    expect(queryByText('시간 수정')).toBeNull(); // 시간 없는 항목은 '시간 추가' (#325)

    await fireEvent.press(getByText('날짜 바꾸기')); // → calendar bottom sheet
    await fireEvent.press(getByLabelText(OTHER_DAY)); // draft only — not saved yet
    expect(onUpdateTodoDueDate).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('확인'));
    expect(onUpdateTodoDueDate).toHaveBeenCalledWith('t9', OTHER_DAY);
  });

  it('투두에도 시간 항목 — 없으면 시간 추가, 저장 시 dueTime 콜백 (#325)', async () => {
    const onUpdateRoutineTime = jest.fn();
    const todos = [
      { id: 't9', title: '장보기', kind: 'todo' as const, dueDate: TODAY, category: '건강' },
    ];
    const { getByText, getByLabelText } = await render(
      <MyRoomScreen routines={todos} onUpdateRoutineTime={onUpdateRoutineTime} />,
    );
    await fireEvent.press(getByText('장보기'));
    // 알림 시간 시트 재사용 — 토글 켜고 저장하면 기본 07:00으로 콜백.
    await fireEvent.press(getByText('시간 추가'));
    await fireEvent.press(getByLabelText('알림 받기'));
    await fireEvent.press(getByLabelText('알림 저장'));
    expect(onUpdateRoutineTime).toHaveBeenCalledWith('t9', true, '07:00');
  });

  it('시간 라벨 분기 — 시간 있는 루틴은 시간 수정, 없는 루틴은 시간 추가 (#325)', async () => {
    const { getByText, queryByText, getByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} />,
    );
    // '하루 회고'는 23:00 알림 보유 → 시간 수정.
    await fireEvent.press(getByText('하루 회고'));
    expect(getByText('시간 수정')).toBeTruthy();
    // 시간 수정 → 알림 시트 열림(메뉴 닫힘) → 닫기.
    await fireEvent.press(getByText('시간 수정'));
    await fireEvent.press(getByLabelText('닫기'));
    // '물 2L 마시기'는 alarmEnabled: false → 시간 추가.
    await fireEvent.press(getByText('물 2L 마시기'));
    expect(queryByText('시간 수정')).toBeNull();
    expect(getByText('시간 추가')).toBeTruthy();
  });

  it('cancels a date change without saving', async () => {
    const onUpdateTodoDueDate = jest.fn();
    const todos = [
      { id: 't9', title: '장보기', kind: 'todo' as const, dueDate: TODAY, category: '건강' },
    ];
    const { getByText, getByLabelText } = await render(
      <MyRoomScreen routines={todos} onUpdateTodoDueDate={onUpdateTodoDueDate} />,
    );

    await fireEvent.press(getByText('장보기'));
    await fireEvent.press(getByText('날짜 바꾸기'));
    await fireEvent.press(getByLabelText(OTHER_DAY));
    await fireEvent.press(getByLabelText('취소'));
    expect(onUpdateTodoDueDate).not.toHaveBeenCalled();
  });

  it('moves a single routine occurrence via 날짜 바꾸기, repeat untouched', async () => {
    const onMoveRoutineOccurrence = jest.fn();
    const { getByText, getByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onMoveRoutineOccurrence={onMoveRoutineOccurrence} />,
    );

    await fireEvent.press(getByText('하루 회고')); // routine row → menu sheet
    await fireEvent.press(getByText('날짜 바꾸기'));
    // Routines get the occurrence-move note.
    expect(getByText(/루틴 반복은 그대로 두고/)).toBeTruthy();

    await fireEvent.press(getByLabelText(OTHER_DAY));
    expect(onMoveRoutineOccurrence).not.toHaveBeenCalled();
    await fireEvent.press(getByLabelText('확인'));
    expect(onMoveRoutineOccurrence).toHaveBeenCalledWith('5', OTHER_DAY);
  });

  it('keeps the quick-add button reachable on empty categories', async () => {
    // No routines at all — every category header (and its +) must still render.
    const { getByLabelText } = await render(<MyRoomScreen routines={[]} />);
    expect(getByLabelText('일정 할 일 추가')).toBeTruthy();
    expect(getByLabelText('취미 할 일 추가')).toBeTruthy();
  });

  it('saves the room image from the hamburger menu (#245)', async () => {
    const { getByLabelText, getByText } = await render(
      <ToastProvider>
        <MyRoomScreen routines={[]} />
      </ToastProvider>,
    );
    await fireEvent.press(getByLabelText('메뉴'));
    await fireEvent.press(getByText('방 이미지 저장'));
    // jest 목: 권한 허용 + 캡처 성공 → 성공 토스트.
    await waitFor(() => expect(getByText('방 이미지를 갤러리에 저장했어요')).toBeTruthy());
  });

  it('opens the hamburger menu and routes each item', async () => {
    const onEdit = jest.fn();
    const onAddRoutine = jest.fn();
    const onManageRoutines = jest.fn();
    const onManageCategories = jest.fn();
    const { getByLabelText, getByText } = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        onEdit={onEdit}
        onAddRoutine={onAddRoutine}
        onManageRoutines={onManageRoutines}
        onManageCategories={onManageCategories}
      />,
    );

    await fireEvent.press(getByLabelText('메뉴'));
    // getByLabelText: the bottom 방 꾸미기 button uses a distinct label (열기).
    await fireEvent.press(getByLabelText('방 꾸미기'));
    expect(onEdit).toHaveBeenCalledTimes(1);

    // 메뉴의 루틴 관리는 onManageRoutines로 — +의 바로 추가와 분리 (#335).
    await fireEvent.press(getByLabelText('메뉴'));
    await fireEvent.press(getByText('루틴 관리'));
    expect(onManageRoutines).toHaveBeenCalledTimes(1);
    expect(onAddRoutine).not.toHaveBeenCalled();

    // 카테고리 관리 routes to the dedicated screen (#394).
    await fireEvent.press(getByLabelText('메뉴'));
    await fireEvent.press(getByText('카테고리 관리'));
    expect(onManageCategories).toHaveBeenCalledTimes(1);
  });

  it('오늘의 루틴 + 버튼은 바로 루틴 추가 콜백을 부른다 (#335)', async () => {
    const onAddRoutine = jest.fn();
    const onManageRoutines = jest.fn();
    const { getByLabelText, getByText } = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        onAddRoutine={onAddRoutine}
        onManageRoutines={onManageRoutines}
      />,
    );

    // '＋ 루틴' 라벨 필 (#483) — 카테고리 ＋(할 일 추가)와 구분되는 가시 라벨.
    expect(getByText('루틴')).toBeTruthy();
    await fireEvent.press(getByLabelText('루틴 추가'));
    expect(onAddRoutine).toHaveBeenCalledTimes(1);
    expect(onManageRoutines).not.toHaveBeenCalled();
  });

  it('onManageRoutines 미배선이면 메뉴의 루틴 관리는 onAddRoutine으로 폴백', async () => {
    const onAddRoutine = jest.fn();
    const { getByLabelText, getByText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onAddRoutine={onAddRoutine} />,
    );

    await fireEvent.press(getByLabelText('메뉴'));
    await fireEvent.press(getByText('루틴 관리'));
    expect(onAddRoutine).toHaveBeenCalledTimes(1);
  });

  it('puts 알림 inside the hamburger menu, not the header (#257)', async () => {
    const onOpenNotifications = jest.fn();
    const { getByLabelText, queryByLabelText } = await render(
      <MyRoomScreen
        routines={[]}
        onOpenNotifications={onOpenNotifications}
        unreadNotificationCount={2}
      />,
    );

    // No standalone bell button crowding the header — 알림 appears only after
    // opening the menu popover.
    expect(queryByLabelText('알림')).toBeNull();
    await fireEvent.press(getByLabelText('메뉴'));
    await fireEvent.press(getByLabelText('알림'));
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });

  it('hides the 알림 menu item when unwired', async () => {
    const { getByLabelText, queryByLabelText } = await render(<MyRoomScreen routines={[]} />);
    await fireEvent.press(getByLabelText('메뉴'));
    expect(queryByLabelText('알림')).toBeNull();
  });

  it('opens the character picker from the hamburger menu and wears a pick (#260)', async () => {
    const onSelectCharacter = jest.fn();
    const owned = [
      { serverId: 1, id: 'cat' as const, name: '고양이', selected: true },
      { serverId: 4, id: 'panda' as const, name: '판다', selected: false },
    ];
    const { getByLabelText, getByText, queryByText } = await render(
      <MyRoomScreen routines={[]} ownedCharacters={owned} onSelectCharacter={onSelectCharacter} />,
    );

    await fireEvent.press(getByLabelText('메뉴'));
    await fireEvent.press(getByText('캐릭터 교체'));
    expect(getByText('착용 중')).toBeTruthy();

    await fireEvent.press(getByLabelText('판다 착용'));
    expect(onSelectCharacter).toHaveBeenCalledWith(4);
    // The sheet closes after picking — 퇴장 애니메이션(#448)이 끝나길 기다린다.
    await waitFor(() => expect(queryByText('착용 중')).toBeNull());
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

  it('달력탭에 선택 날짜의 전체 완료/총 개수와 진행 바가 보인다 (#346)', async () => {
    // 오늘(로컬 날짜): 5개 중 3개 완료 — 방탭과 같은 집계가 달력탭에도 표시.
    const completions = { '1': [TODAY], '2': [TODAY], '3': [TODAY] };
    const local = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} completions={completions} />,
    );
    await fireEvent.press(local.getByText('달력'));
    expect(local.getByText('이 날의 루틴')).toBeTruthy();
    expect(local.getByText('3 / 5')).toBeTruthy();

    // 서버 날짜(어제): completed 플래그로 집계 — 1/2.
    const calendarDays = {
      [YESTERDAY]: [
        {
          id: '1',
          kind: 'routine' as const,
          title: '지난 루틴',
          completed: true,
          category: '건강',
        },
        { id: '2', kind: 'todo' as const, title: '지난 할 일', completed: false, category: '건강' },
      ],
    };
    const server = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        calendarDays={calendarDays}
        onSelectDate={jest.fn()}
      />,
    );
    await pickCalendarDate(server, YESTERDAY);
    expect(server.getByText('1 / 2')).toBeTruthy();
  });

  it('renders the server list for non-today dates and toggles past routines', async () => {
    const onSelectDate = jest.fn();
    const onToggleCalendarItem = jest.fn();
    const calendarDays = {
      [YESTERDAY]: [
        { id: '1', kind: 'routine' as const, title: '옛 카테고리 루틴', completed: true, category: '99' }, // prettier-ignore
      ],
    };
    const ui = await render(
      <ToastProvider>
        <MyRoomScreen
          routines={SAMPLE_ROUTINES}
          calendarDays={calendarDays}
          onSelectDate={onSelectDate}
          onToggleCalendarItem={onToggleCalendarItem}
          allCategories={[
            { id: '99', name: '옛것', icon: 'sparkle' as const, color: '#FF0000', visibility: 'partial', deleted: true }, // prettier-ignore
          ]}
        />
      </ToastProvider>,
    );
    const { getByText } = ui;

    await pickCalendarDate(ui, YESTERDAY);
    expect(onSelectDate).toHaveBeenCalledWith(YESTERDAY);
    expect(getByText('옛 카테고리 루틴')).toBeTruthy();
    // Grouped under the record-time (deleted) category, like the room tab.
    expect(getByText('옛것')).toBeTruthy();
    expect(
      getByText('지난 날짜도 완료 체크할 수 있어요. (코인은 당일 완료에만 지급돼요)'),
    ).toBeTruthy();

    // Past routines toggle for real — the server accepts past-date logs (#183).
    await fireEvent.press(ui.getByLabelText('옛 카테고리 루틴'));
    expect(onToggleCalendarItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', kind: 'routine' }),
      YESTERDAY,
    );
  });

  it('toggles a past todo in the 달력 tab', async () => {
    const onToggleCalendarItem = jest.fn();
    const calendarDays = {
      [YESTERDAY]: [
        { id: 't1', kind: 'todo' as const, title: '지난 할 일', completed: false, category: '' },
      ],
    };
    const ui = await render(
      <MyRoomScreen
        routines={[]}
        calendarDays={calendarDays}
        onSelectDate={jest.fn()}
        onToggleCalendarItem={onToggleCalendarItem}
      />,
    );

    await pickCalendarDate(ui, YESTERDAY);
    // The row body is inert — only the checkbox toggles.
    await fireEvent.press(ui.getByText('지난 할 일'));
    expect(onToggleCalendarItem).not.toHaveBeenCalled();

    await fireEvent.press(ui.getByLabelText('지난 할 일'));
    expect(onToggleCalendarItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', kind: 'todo' }),
      YESTERDAY,
    );
  });

  it('달력 탭에서 +로 할 일 추가 — 서버 백업 날짜, 기본 마감일은 선택 날짜 (#323)', async () => {
    const onQuickAddRoutine = jest.fn();
    // 어제엔 기록이 없어도 현재 카테고리 헤더가 렌더돼 +가 접근 가능해야 한다.
    const calendarDays = { [YESTERDAY]: [] };
    const ui = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        calendarDays={calendarDays}
        onSelectDate={jest.fn()}
        onQuickAddRoutine={onQuickAddRoutine}
        quickAddDisabledCategoryIds={['일정']}
      />,
    );
    await pickCalendarDate(ui, YESTERDAY);
    // 미션 연동 카테고리는 달력에서도 + 미노출 (방탭과 같은 규칙).
    expect(ui.queryByLabelText('일정 할 일 추가')).toBeNull();
    await fireEvent.press(ui.getByLabelText('건강 할 일 추가'));
    // 날짜 칩이 선택한 날짜(어제)로 프리필된다.
    expect(ui.getByText(YESTERDAY.replaceAll('-', '.'))).toBeTruthy();
    const input = ui.getByPlaceholderText('할 일 입력 후 완료');
    await fireEvent.changeText(input, '어제 밀린 일');
    await fireEvent(input, 'blur');
    expect(onQuickAddRoutine).toHaveBeenCalledWith('건강', '어제 밀린 일', YESTERDAY);
  });

  it('달력 탭 오늘 날짜에서도 +로 할 일 추가 (#323)', async () => {
    const onQuickAddRoutine = jest.fn();
    const ui = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onQuickAddRoutine={onQuickAddRoutine} />,
    );
    await pickCalendarDate(ui, TODAY);
    await fireEvent.press(ui.getByLabelText('건강 할 일 추가'));
    // 오늘이면 날짜 칩은 '오늘'.
    expect(ui.getByText('오늘')).toBeTruthy();
    const input = ui.getByPlaceholderText('할 일 입력 후 완료');
    await fireEvent.changeText(input, '오늘 할 일');
    await fireEvent(input, 'blur');
    expect(onQuickAddRoutine).toHaveBeenCalledWith('건강', '오늘 할 일', TODAY);
  });

  it('달력 탭 행 본문 탭 → 방탭과 같은 메뉴 시트 (오늘, #323)', async () => {
    const onToggleCompletion = jest.fn();
    const ui = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onToggleCompletion={onToggleCompletion} />,
    );
    await pickCalendarDate(ui, TODAY);
    // 카테고리 헤더 아이콘은 방탭과 같은 CategoryIcon(카테고리색 틴트) —
    // 원시 Pictogram이면 탭 간 아이콘 색이 달랐다 (#482 후속).
    expect(ui.getAllByTestId(/^category-icon-/).length).toBeGreaterThan(0);
    await fireEvent.press(ui.getByLabelText('하루 회고 메뉴'));
    expect(ui.getByText('이름 변경')).toBeTruthy();
    expect(ui.getByText('삭제하기')).toBeTruthy();
    // 완료하기는 메뉴를 연 날짜(오늘) 기준으로 토글.
    await fireEvent.press(ui.getByLabelText('하루 회고 완료'));
    expect(onToggleCompletion).toHaveBeenCalledWith('5', TODAY);
  });

  it('달력 서버 날짜의 행도 메뉴 시트 — 완료는 달력 규칙으로 토글 (#323)', async () => {
    const onToggleCalendarItem = jest.fn();
    const todos = [
      {
        id: 't9',
        title: '지난 할 일',
        kind: 'todo' as const,
        dueDate: YESTERDAY,
        category: '건강',
      },
    ];
    const calendarDays = {
      [YESTERDAY]: [
        { id: 't9', kind: 'todo' as const, title: '지난 할 일', completed: false, category: '' },
      ],
    };
    const ui = await render(
      <MyRoomScreen
        routines={todos}
        calendarDays={calendarDays}
        onSelectDate={jest.fn()}
        onToggleCalendarItem={onToggleCalendarItem}
      />,
    );
    await pickCalendarDate(ui, YESTERDAY);
    await fireEvent.press(ui.getByLabelText('지난 할 일 메뉴'));
    expect(ui.getByText('이름 변경')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('지난 할 일 완료'));
    expect(onToggleCalendarItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't9', kind: 'todo' }),
      YESTERDAY,
    );
  });

  it('blocks completion on future dates with a toast', async () => {
    const onToggleCalendarItem = jest.fn();
    const calendarDays = {
      [TOMORROW]: [
        { id: 't2', kind: 'todo' as const, title: '내일 할 일', completed: false, category: '' },
      ],
    };
    const ui = await render(
      <ToastProvider>
        <MyRoomScreen
          routines={[]}
          calendarDays={calendarDays}
          onSelectDate={jest.fn()}
          onToggleCalendarItem={onToggleCalendarItem}
        />
      </ToastProvider>,
    );

    await pickCalendarDate(ui, TOMORROW);
    expect(ui.getByText('미래 날짜는 아직 완료할 수 없어요.')).toBeTruthy();

    await fireEvent.press(ui.getByLabelText('내일 할 일'));
    expect(onToggleCalendarItem).not.toHaveBeenCalled();
    expect(ui.getByText('미래 날짜는 완료할 수 없어요')).toBeTruthy();
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

  it('sinks completed items on server-backed 달력 days too', async () => {
    const calendarDays = {
      [YESTERDAY]: [
        { id: 't1', kind: 'todo' as const, title: '한 일', completed: true, category: '' },
        { id: 't2', kind: 'todo' as const, title: '안 한 일', completed: false, category: '' },
      ],
    };
    const ui = await render(
      <MyRoomScreen routines={[]} calendarDays={calendarDays} onSelectDate={jest.fn()} />,
    );
    await pickCalendarDate(ui, YESTERDAY);
    const labels = ui.getAllByRole('checkbox').map((el) => el.props.accessibilityLabel);
    expect(labels).toEqual(['안 한 일', '한 일']);
  });

  it('groups the 달력 list by category like the room tab', async () => {
    const { getByText, getAllByText } = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} />);
    await fireEvent.press(getByText('달력'));
    // Today's list renders under category headers (emoji + label + count).
    expect(getAllByText('일정').length).toBeGreaterThan(0);
    expect(getAllByText('건강').length).toBeGreaterThan(0);
    expect(getByText('아침 7시 기상')).toBeTruthy();
  });

  it('shows a spinner while a picked date is still loading from the server', async () => {
    const { getByText, getByLabelText, queryByText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} calendarDays={{}} onSelectDate={jest.fn()} />,
    );
    await fireEvent.press(getByText('달력'));
    await fireEvent.press(getByLabelText(OTHER_DAY));
    expect(queryByText('예정된 루틴이 없어요.')).toBeNull();
  });

  it('shows a loading state, an error state with retry, and an empty state', async () => {
    const loading = await render(<MyRoomScreen loading />);
    expect(loading.getByText('불러오는 중…')).toBeTruthy();

    const onRetry = jest.fn();
    const failed = await render(<MyRoomScreen loadError onRetry={onRetry} />);
    await fireEvent.press(failed.getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Brand-new user: no categories, no routines → guided empty state.
    const empty = await render(<MyRoomScreen routines={[]} categories={[]} />);
    expect(empty.getByText('아직 루틴이 없어요.')).toBeTruthy();
  });

  // 인증사진형 잠시 내림 (#499) — PHOTO 루틴도 카메라 없이 일반 체크로 완료된다.
  // 복구 시 아래 주석의 카메라 게이트 테스트를 되살릴 것.
  it('completes a 인증사진형 routine without the camera while shelved (#499)', async () => {
    const onToggleCompletion = jest.fn();
    const { getByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onToggleCompletion={onToggleCompletion} />,
    );

    // '영어 공부' (id 4): photoVerify여도 즉시 완료 토글.
    fireEvent.press(getByLabelText('영어 공부'));
    expect(onToggleCompletion).toHaveBeenCalledWith('4', TODAY);
  });

  // // Camera test last: its photo path leaves a resolved promise that can disrupt
  // // a following test's render in this harness.
  // it('requires a camera photo to complete a 인증사진형 routine', async () => {
  //   const onToggleCompletion = jest.fn();
  //   const onRequestPhoto = jest.fn().mockResolvedValue('file://verify.jpg');
  //   const { getByLabelText } = await render(
  //     <MyRoomScreen
  //       routines={SAMPLE_ROUTINES}
  //       onToggleCompletion={onToggleCompletion}
  //       onRequestPhoto={onRequestPhoto}
  //     />,
  //   );
  //
  //   // '하루 회고' (id 5): no photoVerify → the checkbox toggles today immediately.
  //   fireEvent.press(getByLabelText('하루 회고'));
  //   expect(onToggleCompletion).toHaveBeenCalledWith('5', TODAY);
  //
  //   // '영어 공부' (id 4): photoVerify → camera, then toggle today.
  //   fireEvent.press(getByLabelText('영어 공부'));
  //   await waitFor(() => expect(onToggleCompletion).toHaveBeenCalledWith('4', TODAY));
  //   expect(onRequestPhoto).toHaveBeenCalled();
  // });
});
