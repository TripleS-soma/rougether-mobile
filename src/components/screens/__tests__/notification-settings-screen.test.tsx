import { fireEvent, render } from '@testing-library/react-native';

import { NotificationSettingsScreen } from '@/components/screens/notification-settings-screen';

describe('NotificationSettingsScreen', () => {
  it('renders the title and the server-backed rows (#495)', async () => {
    const { getByText, queryByText } = await render(<NotificationSettingsScreen />);
    expect(getByText('푸시 알림')).toBeTruthy();
    expect(getByText('전체 알림')).toBeTruthy();
    expect(getByText('루틴 리마인더')).toBeTruthy();
    expect(getByText('집 알림')).toBeTruthy();
    // 서버에 없는 항목은 화면에서도 사라졌다 (구 로컬 전용 토글).
    expect(queryByText('마케팅 정보 수신')).toBeNull();
    expect(queryByText(/서버 준비 중/)).toBeNull();
  });

  it('reports the flipped key and value', async () => {
    const onToggle = jest.fn();
    const { getByLabelText } = await render(<NotificationSettingsScreen onToggle={onToggle} />);

    await fireEvent.press(getByLabelText('전체 알림'));
    expect(onToggle).toHaveBeenCalledWith('all', false);

    await fireEvent.press(getByLabelText('집 알림'));
    expect(onToggle).toHaveBeenCalledWith('house', false);
  });

  it('ignores group toggles while the master is off (server keeps their values)', async () => {
    const onToggle = jest.fn();
    const { getByLabelText } = await render(
      <NotificationSettingsScreen
        settings={{ all: false, reminder: true, house: true }}
        onToggle={onToggle}
      />,
    );

    await fireEvent.press(getByLabelText('루틴 리마인더'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
