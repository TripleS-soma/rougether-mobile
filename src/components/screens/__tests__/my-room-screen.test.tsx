import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import { todayIso } from '@/utils/datetime';

const TODAY = todayIso();

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

  it('shows a kebab menu button per routine and a quick-add button per category', async () => {
    const { getByLabelText } = await render(<MyRoomScreen routines={SAMPLE_ROUTINES} />);
    // Per-routine kebab (수정/삭제 menu trigger).
    expect(getByLabelText('물 2L 마시기 메뉴')).toBeTruthy();
    expect(getByLabelText('하루 회고 메뉴')).toBeTruthy();
    // Per-category quick-add todo button.
    expect(getByLabelText('일정 할 일 추가')).toBeTruthy();
    expect(getByLabelText('건강 할 일 추가')).toBeTruthy();
  });

  it('keeps the quick-add button reachable on empty categories', async () => {
    // No routines at all — every category header (and its +) must still render.
    const { getByLabelText } = await render(<MyRoomScreen routines={[]} />);
    expect(getByLabelText('일정 할 일 추가')).toBeTruthy();
    expect(getByLabelText('취미 할 일 추가')).toBeTruthy();
  });

  it('opens the hamburger menu and routes each item', async () => {
    const onEdit = jest.fn();
    const onAddRoutine = jest.fn();
    const { getByLabelText, getByText, queryByText } = await render(
      <MyRoomScreen routines={SAMPLE_ROUTINES} onEdit={onEdit} onAddRoutine={onAddRoutine} />,
    );

    await fireEvent.press(getByLabelText('메뉴'));
    // getByLabelText: the bottom "방 편집" button shares the same text.
    await fireEvent.press(getByLabelText('방 편집'));
    expect(onEdit).toHaveBeenCalledTimes(1);

    await fireEvent.press(getByLabelText('메뉴'));
    await fireEvent.press(getByText('루틴 관리'));
    expect(onAddRoutine).toHaveBeenCalledTimes(1);

    // 카테고리 관리 opens the manager sheet in-place.
    await fireEvent.press(getByLabelText('메뉴'));
    await fireEvent.press(getByText('카테고리 관리'));
    expect(queryByText('새 카테고리 만들기')).toBeTruthy();
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

  it('renders uncategorized routines even when the user has no categories', async () => {
    // API state after a fresh account adds routines without a category:
    // categories = [], routines have no category → must show in a 기타 group,
    // not vanish while the counter says 0 / 2.
    const routines = [
      { id: '2', title: '아침 기상', kind: 'routine' as const },
      { id: '3', title: '독서 30분', kind: 'routine' as const },
    ];
    const { getByText } = await render(<MyRoomScreen routines={routines} categories={[]} />);
    expect(getByText('아침 기상')).toBeTruthy();
    expect(getByText('독서 30분')).toBeTruthy();
    expect(getByText('기타')).toBeTruthy();
    expect(getByText('0 / 2')).toBeTruthy();
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

  // Camera test last: its photo path leaves a resolved promise that can disrupt
  // a following test's render in this harness.
  it('requires a camera photo to complete a 인증사진형 routine', async () => {
    const onToggleCompletion = jest.fn();
    const onRequestPhoto = jest.fn().mockResolvedValue('file://verify.jpg');
    const { getByText } = await render(
      <MyRoomScreen
        routines={SAMPLE_ROUTINES}
        onToggleCompletion={onToggleCompletion}
        onRequestPhoto={onRequestPhoto}
      />,
    );

    // '하루 회고' (id 5): no photoVerify → toggles today immediately.
    fireEvent.press(getByText('하루 회고'));
    expect(onToggleCompletion).toHaveBeenCalledWith('5', TODAY);

    // '영어 공부' (id 4): photoVerify → camera, then toggle today.
    fireEvent.press(getByText('영어 공부'));
    await waitFor(() => expect(onToggleCompletion).toHaveBeenCalledWith('4', TODAY));
    expect(onRequestPhoto).toHaveBeenCalled();
  });
});
