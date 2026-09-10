import { act, fireEvent, render } from '@testing-library/react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import {
  FULL_SWIPE_RATIO,
  isFullSwipe,
  NotificationListScreen,
} from '@/components/screens/notification-list-screen';

const NOTIFICATIONS = [
  { id: 1, type: 'ROUTINE_REMINDER', title: '루틴 리마인드', body: '물 마시기 할 시간이에요', read: false, date: '7월 12일' }, // prettier-ignore
  { id: 2, type: 'HOUSE_KICK', title: '집 알림', body: '아침 기상단에서 내보내졌어요', read: true, date: '7월 5일' }, // prettier-ignore
];

describe('isFullSwipe (#1137)', () => {
  it('행 폭의 절반 이상 왼쪽으로 밀린 채 놓았을 때만 끝까지 밀기다', () => {
    expect(FULL_SWIPE_RATIO).toBe(0.5);
    expect(isFullSwipe(-180, 360)).toBe(true);
    expect(isFullSwipe(-179, 360)).toBe(false);
    // 오른쪽으로 민 건 삭제가 아니다.
    expect(isFullSwipe(200, 360)).toBe(false);
    // 폭을 아직 못 쟀으면 즉시 삭제하지 않는다 — 버튼만 드러난다.
    expect(isFullSwipe(-500, 0)).toBe(false);
  });
});

describe('NotificationListScreen', () => {
  it('renders rows and marks an unread one read on tap', async () => {
    const onRead = jest.fn();
    const { getByText, getByLabelText } = await render(
      <NotificationListScreen notifications={NOTIFICATIONS} onRead={onRead} />,
    );

    expect(getByText('물 마시기 할 시간이에요')).toBeTruthy();
    expect(getByText('아침 기상단에서 내보내졌어요')).toBeTruthy();

    await fireEvent.press(getByLabelText('루틴 리마인드'));
    expect(onRead).toHaveBeenCalledWith(1);

    // Already-read rows don't re-fire the read receipt.
    await fireEvent.press(getByLabelText('집 알림'));
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it('shows 모두 읽음 only while something is unread', async () => {
    const onReadAll = jest.fn();
    const someUnread = await render(
      <NotificationListScreen notifications={NOTIFICATIONS} onReadAll={onReadAll} />,
    );
    await fireEvent.press(someUnread.getByLabelText('모두 읽음'));
    expect(onReadAll).toHaveBeenCalledTimes(1);

    const allRead = await render(
      <NotificationListScreen notifications={NOTIFICATIONS.map((n) => ({ ...n, read: true }))} />,
    );
    expect(allRead.queryByLabelText('모두 읽음')).toBeNull();
  });

  it('shows the empty state and the 더보기 pagination', async () => {
    const empty = await render(<NotificationListScreen notifications={[]} />);
    expect(empty.getByText('아직 받은 알림이 없어요.')).toBeTruthy();

    const onLoadMore = jest.fn();
    const paged = await render(
      <NotificationListScreen notifications={NOTIFICATIONS} hasNext onLoadMore={onLoadMore} />,
    );
    await fireEvent.press(paged.getByLabelText('알림 더보기'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  // 로드 실패는 빈 상태('알림 없음')로 위장하지 않는다 (#549).
  it('로드 실패 시 빈 상태 대신 실패 + 다시 시도를 보여준다 (#549)', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <NotificationListScreen notifications={[]} loadError onRetry={onRetry} />,
    );

    expect(getByText('알림을 불러오지 못했어요.')).toBeTruthy();
    expect(queryByText('아직 받은 알림이 없어요.')).toBeNull();
    await fireEvent.press(getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  describe('전체 삭제 (#1137)', () => {
    it('확인 다이얼로그에서 삭제를 눌러야 onDeleteAll을 부른다', async () => {
      const onDeleteAll = jest.fn();
      const ui = await render(
        <NotificationListScreen notifications={NOTIFICATIONS} onDeleteAll={onDeleteAll} />,
      );

      await fireEvent.press(ui.getByLabelText('알림 전체 삭제'));
      expect(ui.getByText('알림을 모두 삭제할까요?')).toBeTruthy();
      // 취소는 아무것도 지우지 않는다.
      await fireEvent.press(ui.getByLabelText('취소'));
      expect(onDeleteAll).not.toHaveBeenCalled();

      await fireEvent.press(ui.getByLabelText('알림 전체 삭제'));
      await fireEvent.press(ui.getByLabelText('알림 전체 삭제 확인'));
      expect(onDeleteAll).toHaveBeenCalledTimes(1);
    });

    it('모두 읽은 뒤에도 남고, 알림이 없으면 사라진다', async () => {
      const allRead = await render(
        <NotificationListScreen notifications={NOTIFICATIONS.map((n) => ({ ...n, read: true }))} />,
      );
      expect(allRead.getByLabelText('알림 전체 삭제')).toBeTruthy();

      const empty = await render(<NotificationListScreen notifications={[]} />);
      expect(empty.queryByLabelText('알림 전체 삭제')).toBeNull();
    });
  });

  describe('스와이프 삭제 (#1137)', () => {
    it('짧게 밀어 드러난 삭제 버튼을 탭하면 onDelete — 읽은 행도 지울 수 있다', async () => {
      const onDelete = jest.fn();
      const { getByLabelText } = await render(
        <NotificationListScreen notifications={NOTIFICATIONS} onDelete={onDelete} />,
      );
      await fireEvent.press(getByLabelText('루틴 리마인드 삭제'));
      expect(onDelete).toHaveBeenCalledWith(1);
      await fireEvent.press(getByLabelText('집 알림 삭제'));
      expect(onDelete).toHaveBeenCalledWith(2);
    });

    it('스와이프 읽음(#560)은 없어졌다 — 읽음은 행 탭으로만', async () => {
      const { queryByLabelText } = await render(
        <NotificationListScreen notifications={NOTIFICATIONS} onRead={jest.fn()} onDelete={jest.fn()} />, // prettier-ignore
      );
      expect(queryByLabelText('루틴 리마인드 읽음')).toBeNull();
    });

    it('onDelete가 없으면 삭제 버튼도 없다 (같은 Swipeable 트리, 팬만 꺼짐)', async () => {
      const ui = await render(<NotificationListScreen notifications={NOTIFICATIONS} />);
      expect(ui.queryByLabelText('루틴 리마인드 삭제')).toBeNull();
      expect(ui.getByTestId('notification-swipe-1')).toBeTruthy();
    });

    it('스크린리더 행 동작으로도 삭제할 수 있다', async () => {
      const onDelete = jest.fn();
      const { getByLabelText } = await render(
        <NotificationListScreen notifications={NOTIFICATIONS} onDelete={onDelete} />,
      );
      await fireEvent(getByLabelText('집 알림'), 'accessibilityAction', {
        nativeEvent: { actionName: 'delete' },
      });
      expect(onDelete).toHaveBeenCalledWith(2);
    });
  });

  // 끝까지 밀기 (#1137). 이 테스트는 파일 마지막에 둔다: Swipeable prop을 직접
  // 호출하면(스프링 애니메이션 잔여물) 다음 테스트의 렌더가 깨진다 — #560 때와
  // 같은 하니스 특성. RNTL 14에는 컴포지트 쿼리가 없어 fiber를 거슬러 올라간다.
  it('놓는 순간 행 폭 절반 넘게 밀려 있으면 즉시 삭제, 아니면 버튼만 남는다 (#1137)', async () => {
    const onDelete = jest.fn();
    const ui = await render(
      <NotificationListScreen notifications={NOTIFICATIONS} onDelete={onDelete} />,
    );
    await fireEvent(ui.getByTestId('notification-row-1'), 'layout', {
      nativeEvent: { layout: { width: 360, height: 72 } },
    });

    // 삭제 버튼이 받은 translation(Swipeable의 밀린 거리) — 놓는 순간 값을 흉내 낸다.
    let action: any = ui.getByLabelText('루틴 리마인드 삭제').unstable_fiber;
    while (action && !action.memoizedProps?.translation) action = action.return;
    const translation = action.memoizedProps.translation;

    let swipe: any = ui.getByTestId('notification-swipe-1').unstable_fiber;
    while (swipe && swipe.type !== ReanimatedSwipeable) swipe = swipe.return;
    expect(swipe).toBeTruthy();

    // 짧게 밀기(버튼 폭 근처) — 열리기만 하고 지우지 않는다.
    translation.value = -80;
    act(() => swipe.memoizedProps.onSwipeableWillOpen('left'));
    expect(onDelete).not.toHaveBeenCalled();

    // 끝까지 밀기(폭 360의 절반 이상) — 바로 지운다.
    translation.value = -200;
    act(() => swipe.memoizedProps.onSwipeableWillOpen('left'));
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
