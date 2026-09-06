import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { LoginConflictDialog } from '@/components/screens/login/login-conflict-dialog';

const noop = () => {};

function setPlatform(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
}

describe('LoginConflictDialog — 같은 이메일 타 provider 안내', () => {
  const originalOS = Platform.OS;
  afterEach(() => setPlatform(originalOS as 'ios' | 'android'));

  it('기존 provider 가 하나면 [OO로 로그인] 버튼과 그 안내가 뜬다', async () => {
    const onLoginWith = jest.fn();
    const screen = await render(
      <LoginConflictDialog
        visible
        message="이 이메일은 카카오 로그인으로 가입되어 있어요."
        providers={['kakao']}
        onLoginWith={onLoginWith}
        onContinueAsNew={noop}
        onDismiss={noop}
      />,
    );
    expect(screen.getByText(/기존 계정을 쓰려면 카카오로 로그인하고/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('카카오로 로그인'));
    expect(onLoginWith).toHaveBeenCalledWith('kakao');
  });

  it('Android 에서 애플 계정이면 버튼을 숨기고 iOS 기기 안내를 준다 — 없는 버튼을 가리키지 않는다', async () => {
    setPlatform('android');
    const screen = await render(
      <LoginConflictDialog
        visible
        message="이 이메일은 애플 로그인으로 가입되어 있어요."
        providers={['apple']}
        onLoginWith={noop}
        onContinueAsNew={noop}
        onDismiss={noop}
      />,
    );
    expect(screen.queryByLabelText('애플로 로그인')).toBeNull();
    expect(screen.getByText(/이 기기에서는 애플 로그인을 쓸 수 없어요/)).toBeTruthy();
    expect(screen.getByLabelText('새 계정으로 계속')).toBeTruthy();
  });

  it('provider 가 둘 이상이면 버튼 없이 "닫고 직접 누르라"고 안내한다', async () => {
    const screen = await render(
      <LoginConflictDialog
        visible
        message="이 이메일은 애플·구글 로그인으로 가입되어 있어요."
        providers={['apple', 'google']}
        onLoginWith={noop}
        onContinueAsNew={noop}
        onDismiss={noop}
      />,
    );
    expect(screen.queryByLabelText(/로 로그인$/)).toBeNull();
    expect(screen.getByText(/이 창을 닫고 애플·구글 버튼으로 로그인하고/)).toBeTruthy();
  });

  it('[새 계정으로 계속]·[닫기]는 각각의 콜백만 부른다', async () => {
    const onContinueAsNew = jest.fn();
    const onDismiss = jest.fn();
    const screen = await render(
      <LoginConflictDialog
        visible
        message="m"
        providers={['google']}
        onLoginWith={noop}
        onContinueAsNew={onContinueAsNew}
        onDismiss={onDismiss}
      />,
    );
    await fireEvent.press(screen.getByLabelText('새 계정으로 계속'));
    expect(onContinueAsNew).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('닫기'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
