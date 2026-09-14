import { act, fireEvent, render } from '@testing-library/react-native';

import { SettingsScreen } from '@/components/screens/settings-screen';
import { BottomNav } from '@/components/ui/bottom-nav';
import { i18n } from '@/i18n';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('설정 · 언어 (#893)', () => {
  it('언어 행이 현재 언어를 그 언어의 이름으로 보이고 누르면 언어 화면을 연다', async () => {
    const onOpenLanguage = jest.fn();
    const ui = await render(<SettingsScreen language="en" onOpenLanguage={onOpenLanguage} />);
    expect(ui.getByText('English')).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('언어'));
    expect(onOpenLanguage).toHaveBeenCalledTimes(1);
  });

  it('영어로 바꾸면 설정 화면과 하단 탭 문구가 영어로 그려진다', async () => {
    const ui = await render(
      <>
        <SettingsScreen />
        <BottomNav active="myRoom" onChange={() => {}} />
      </>,
    );
    expect(ui.getByText('설정')).toBeTruthy();
    expect(ui.getByLabelText('나의 방')).toBeTruthy();
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(ui.getByText('Settings')).toBeTruthy();
    expect(ui.getByText('Dark mode')).toBeTruthy();
    expect(ui.getByLabelText('My Room')).toBeTruthy();
    expect(ui.getByText('Log out')).toBeTruthy();
    expect(ui.queryByText('설정')).toBeNull();
  });
});
