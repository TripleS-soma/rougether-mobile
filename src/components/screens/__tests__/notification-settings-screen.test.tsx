import { fireEvent, render } from '@testing-library/react-native';

import { NotificationSettingsScreen } from '@/components/screens/notification-settings-screen';

describe('NotificationSettingsScreen', () => {
  it('renders the title and category rows', async () => {
    const { getByText } = await render(<NotificationSettingsScreen />);
    expect(getByText('푸시 알림')).toBeTruthy();
    expect(getByText('전체 알림')).toBeTruthy();
    expect(getByText('루틴 리마인더')).toBeTruthy();
    expect(getByText('마케팅 정보 수신')).toBeTruthy();
  });

  it('reports a change when the master toggle is pressed', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await render(<NotificationSettingsScreen onChange={onChange} />);

    await fireEvent.press(getByLabelText('전체 알림'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ all: false }));
  });
});
