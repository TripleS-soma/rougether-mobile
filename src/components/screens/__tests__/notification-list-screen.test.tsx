import { fireEvent, render } from '@testing-library/react-native';

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
});
