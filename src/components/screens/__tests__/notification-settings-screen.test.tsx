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

  // 조회 실패 시 기본값이 서버값처럼 보이지 않게 안내한다 (#549).
  it('로드 실패 시 안내 배너 + 다시 불러오기를 보여준다 (#549)', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText, queryByText, rerender } = await render(
      <NotificationSettingsScreen loadError onRetry={onRetry} />,
    );

    expect(getByText(/설정을 불러오지 못했어요/)).toBeTruthy();
    await fireEvent.press(getByLabelText('다시 불러오기'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    // 재조회 성공(해제) 시 배너가 사라진다.
    await rerender(<NotificationSettingsScreen loadError={false} onRetry={onRetry} />);
    expect(queryByText(/설정을 불러오지 못했어요/)).toBeNull();
  });
});
