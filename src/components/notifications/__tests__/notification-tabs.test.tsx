import { fireEvent, render } from '@testing-library/react-native';

import { NotificationTabs } from '@/components/notifications/notification-tabs';

describe('NotificationTabs (#1320)', () => {
  it('marks the selected tab, shows unread dots per tab, and reports changes', async () => {
    const onChange = jest.fn();
    const { getByLabelText, getByTestId, queryByTestId } = await render(
      <NotificationTabs
        value="notifications"
        onChange={onChange}
        unread={{ notifications: false, news: true }}
      />,
    );
    expect(getByLabelText('내 알림 탭').props.accessibilityState).toEqual({ selected: true });
    expect(getByLabelText('새 소식 탭').props.accessibilityState).toEqual({ selected: false });
    expect(getByTestId('notification-tab-dot-news')).toBeTruthy();
    expect(queryByTestId('notification-tab-dot-notifications')).toBeNull();

    await fireEvent.press(getByLabelText('새 소식 탭'));
    expect(onChange).toHaveBeenCalledWith('news');
  });
});
