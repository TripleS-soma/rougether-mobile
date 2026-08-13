import { act, fireEvent, render } from '@testing-library/react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { NotificationListScreen } from '@/components/screens/notification-list-screen';

const NOTIFICATIONS = [
  { id: 1, type: 'ROUTINE_REMINDER', title: '루틴 리마인드', body: '물 마시기 할 시간이에요', read: false, date: '7월 12일' }, // prettier-ignore
  { id: 2, type: 'HOUSE_KICK', title: '집 알림', body: '아침 기상단에서 내보내졌어요', read: true, date: '7월 5일' }, // prettier-ignore
];

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

  it('스와이프로 드러난 읽음 액션 탭도 onRead를 부른다 (#560)', async () => {
    const onRead = jest.fn();
    const { getByLabelText } = await render(
      <NotificationListScreen notifications={NOTIFICATIONS} onRead={onRead} />,
    );
    await fireEvent.press(getByLabelText('루틴 리마인드 읽음'));
    expect(onRead).toHaveBeenCalledWith(1);
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

  // 스와이프 읽음 (#560) — 읽지 않은 행만 활성, 임계 통과 시 onRead.
  // 이 테스트는 파일 마지막에 둔다: Swipeable prop을 직접 호출하면(스프링
  // 애니메이션 잔여물) 다음 테스트의 렌더가 깨진다 — 위 카메라 테스트 주석과
  // 같은 하니스 특성.
  it('읽지 않은 행만 스와이프 활성, 임계 통과 시 읽음 처리한다 (#560)', async () => {
    const onRead = jest.fn();
    const ui = await render(
      <NotificationListScreen notifications={NOTIFICATIONS} onRead={onRead} />,
    );

    // 읽지 않은 행만 Swipeable로 감싸인다 — 읽은 행은 스와이프 비활성.
    const unread = ui.getByTestId('notification-swipe-1');
    expect(ui.queryByTestId('notification-swipe-2')).toBeNull();

    // 임계를 넘겨 놓으면(onSwipeableWillOpen) 읽음 콜백이 나간다. RNTL 14에는
    // 컴포지트 쿼리가 없어 fiber를 거슬러 Swipeable prop을 직접 부른다.
    let fiber: any = unread.unstable_fiber;
    while (fiber && fiber.type !== ReanimatedSwipeable) fiber = fiber.return;
    expect(fiber).toBeTruthy();
    act(() => fiber.memoizedProps.onSwipeableWillOpen('right'));
    expect(onRead).toHaveBeenCalledWith(1);
  });
});
