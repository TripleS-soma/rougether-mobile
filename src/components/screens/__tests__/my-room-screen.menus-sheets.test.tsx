import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { ToastProvider } from '@/components/ui/toast';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import { OTHER_DAY, TODAY } from '@/test-utils/my-room-screen-fixtures';

describe('MyRoomScreen', () => {
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
    const { getByText, getByLabelText, findByLabelText, queryByText } = await render(
      <MyRoomScreen routines={todos} onUpdateTodoDueDate={onUpdateTodoDueDate} />,
    );

    await fireEvent.press(getByText('장보기')); // row body → menu sheet
    expect(queryByText('시간 수정')).toBeNull(); // 시간 없는 항목은 '시간 추가' (#325)

    await fireEvent.press(getByText('날짜 바꾸기')); // → calendar bottom sheet
    await fireEvent.press(await findByLabelText(OTHER_DAY, {}, { timeout: 3000 })); // draft only — not saved yet
    expect(onUpdateTodoDueDate).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('확인'));
    expect(onUpdateTodoDueDate).toHaveBeenCalledWith('t9', OTHER_DAY);
  });

  it('투두에도 시간 항목 — 없으면 시간 추가, 저장 시 dueTime 콜백 (#325)', async () => {
    const onUpdateRoutineTime = jest.fn();
    const todos = [
      { id: 't9', title: '장보기', kind: 'todo' as const, dueDate: TODAY, category: '건강' },
    ];
    const { getByText, getByLabelText, findByLabelText } = await render(
      <MyRoomScreen routines={todos} onUpdateRoutineTime={onUpdateRoutineTime} />,
    );
    await fireEvent.press(getByText('장보기'));
    // 알림 시간 시트 재사용 — 토글 켜고 저장하면 기본 07:00으로 콜백.
    await fireEvent.press(getByText('시간 추가'));
    await fireEvent.press(await findByLabelText('알림 받기'));
    await fireEvent.press(getByLabelText('알림 저장'));
    expect(onUpdateRoutineTime).toHaveBeenCalledWith('t9', true, '07:00');
  });

  it('시간 라벨 분기 — 시간 있는 루틴은 시간 수정, 없는 루틴은 시간 추가 (#325)', async () => {
    const { getByText, queryByText, findByText, findByLabelText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} />,
    );
    // '하루 회고'는 23:00 알림 보유 → 시간 수정.
    await fireEvent.press(getByText('하루 회고'));
    expect(getByText('시간 수정')).toBeTruthy();
    // 시간 수정 → (메뉴 퇴장 뒤) 알림 시트 열림 → 닫기.
    await fireEvent.press(getByText('시간 수정'));
    await fireEvent.press(await findByLabelText('닫기'));
    // '물 2L 마시기'는 alarmEnabled: false → 시간 추가.
    await fireEvent.press(getByText('물 2L 마시기'));
    expect(await findByText('시간 추가')).toBeTruthy();
    expect(queryByText('시간 수정')).toBeNull();
  });

  it('cancels a date change without saving', async () => {
    const onUpdateTodoDueDate = jest.fn();
    const todos = [
      { id: 't9', title: '장보기', kind: 'todo' as const, dueDate: TODAY, category: '건강' },
    ];
    const { getByText, getByLabelText, findByLabelText } = await render(
      <MyRoomScreen routines={todos} onUpdateTodoDueDate={onUpdateTodoDueDate} />,
    );

    await fireEvent.press(getByText('장보기'));
    await fireEvent.press(getByText('날짜 바꾸기'));
    await fireEvent.press(await findByLabelText(OTHER_DAY, {}, { timeout: 3000 }));
    await fireEvent.press(getByLabelText('취소'));
    expect(onUpdateTodoDueDate).not.toHaveBeenCalled();
  });

  it('moves a single routine occurrence via 날짜 바꾸기, repeat untouched', async () => {
    const onMoveRoutineOccurrence = jest.fn();
    const { getByText, getByLabelText, findByText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onMoveRoutineOccurrence={onMoveRoutineOccurrence} />,
    );

    await fireEvent.press(getByText('하루 회고')); // routine row → menu sheet
    await fireEvent.press(getByText('날짜 바꾸기'));
    // Routines get the occurrence-move note.
    expect(await findByText(/루틴 반복은 그대로 두고/, {}, { timeout: 3000 })).toBeTruthy();

    await fireEvent.press(getByLabelText(OTHER_DAY));
    expect(onMoveRoutineOccurrence).not.toHaveBeenCalled();
    await fireEvent.press(getByLabelText('확인'));
    expect(onMoveRoutineOccurrence).toHaveBeenCalledWith('5', OTHER_DAY);
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
    const { getByLabelText, getByText, getAllByLabelText } = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        onEdit={onEdit}
        onAddRoutine={onAddRoutine}
        onManageRoutines={onManageRoutines}
        onManageCategories={onManageCategories}
      />,
    );

    await fireEvent.press(getByLabelText('메뉴'));
    // '방 꾸미기'는 플로팅 버튼(#727)과 메뉴 항목 둘 다 존재 — 메뉴(모달,
    // 트리상 뒤)의 항목을 집어 메뉴 경로가 살아 있음을 검증한다.
    const decorItems = getAllByLabelText('방 꾸미기');
    await fireEvent.press(decorItems[decorItems.length - 1]);
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

  it('알림 벨이 헤더에 1탭으로 노출된다 (#727 — #257 메뉴 합체를 복원)', async () => {
    const onOpenNotifications = jest.fn();
    const { getByLabelText } = await render(
      <MyRoomScreen
        routines={[]}
        onOpenNotifications={onOpenNotifications}
        unreadNotificationCount={2}
      />,
    );
    // 메뉴를 거치지 않고 헤더 벨 바로 — depth 1탭.
    await fireEvent.press(getByLabelText('알림'));
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });

  it('알림 미배선이면 헤더 벨을 숨긴다', async () => {
    const { queryByLabelText } = await render(<MyRoomScreen routines={[]} />);
    expect(queryByLabelText('알림')).toBeNull();
  });

  it('방 꾸미기 플로팅 버튼 — 방 위에서 1탭 진입 (#727)', async () => {
    const onEdit = jest.fn();
    const { getByLabelText } = await render(<MyRoomScreen routines={[]} onEdit={onEdit} />);
    await fireEvent.press(getByLabelText('방 꾸미기'));
    expect(onEdit).toHaveBeenCalledTimes(1);
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

  /**
   * 출석 이벤트·재화 내역은 내 정보 바로가기로 (#851 → #1055 → #1089) —
   * 방 메뉴는 방 작업만 남고 메뉴 버튼의 미출석 점도 하단 탭 배지로 갔다.
   */
  it('방 메뉴에 출석 이벤트·재화 내역이 없고 메뉴 버튼 라벨은 항상 "메뉴" (#1089)', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <ToastProvider>
        <MyRoomScreen userName="준서" routines={[]} />
      </ToastProvider>,
    );
    expect(queryByLabelText(/오늘 미출석/)).toBeNull();
    await fireEvent.press(getByLabelText('메뉴'));
    expect(getByLabelText('방 꾸미기')).toBeTruthy();
    expect(queryByLabelText(/출석 이벤트/)).toBeNull();
    expect(queryByLabelText('재화 내역')).toBeNull();
  });
});
