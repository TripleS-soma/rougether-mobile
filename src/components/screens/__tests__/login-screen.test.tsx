import { fireEvent, render } from '@testing-library/react-native';

import { LoginScreen } from '@/components/screens/login-screen';
import { ToastProvider } from '@/components/ui/toast';

describe('LoginScreen', () => {
  /**
   * 배지가 라벨을 덮던 버그 (#835) — 로고와 배지가 둘 다 position:absolute라
   * 라벨이 버튼 전체 폭 기준으로 가운데 정렬됐고, 라벨이 길면 배지 밑으로
   * 들어갔다. 겹침 자체는 jest에서 못 재므로, **겹칠 수 없는 구조**인지를
   * 단언한다: 배지는 흐름에 있고(absolute 아님) 라벨은 남은 폭을 차지한다.
   */
  it('최근 로그인 배지는 절대 배치가 아니고 라벨이 남은 폭을 차지한다 (#835)', async () => {
    const { getByText } = await render(<LoginScreen lastLoginProvider="kakao" />);

    const flatten = (style: unknown): Record<string, unknown> =>
      Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

    const badge = flatten(getByText('최근 로그인').props.style);
    const label = flatten(getByText('Kakao로 시작하기').props.style);

    expect(badge.position).toBeUndefined();
    expect(label.flex).toBe(1);
  });

  it('renders the brand title', async () => {
    const { getByText } = await render(<LoginScreen />);
    expect(getByText('루게더')).toBeTruthy();
  });

  it('submits with email + password filled', async () => {
    const onAuthSuccess = jest.fn();
    const { getByText, getByPlaceholderText } = await render(
      <LoginScreen onAuthSuccess={onAuthSuccess} />,
    );

    await fireEvent.changeText(getByPlaceholderText('이메일'), 'a@b.com');
    await fireEvent.changeText(getByPlaceholderText('비밀번호'), 'secret');
    await fireEvent.press(getByText('로그인'));

    expect(onAuthSuccess).toHaveBeenCalledTimes(1);
  });

  it('signs into a specific account when the field holds a numeric userId', async () => {
    const onLogin = jest.fn(async () => true);
    const { getByText, getByPlaceholderText } = await render(<LoginScreen onLogin={onLogin} />);

    await fireEvent.changeText(getByPlaceholderText('이메일'), '7');
    await fireEvent.changeText(getByPlaceholderText('비밀번호'), 'x');
    await fireEvent.press(getByText('로그인'));

    expect(onLogin).toHaveBeenCalledWith(7);
  });

  it('creates a fresh account when the userId field is empty', async () => {
    const onLogin = jest.fn(async () => true);
    const { getByText, getByPlaceholderText } = await render(<LoginScreen onLogin={onLogin} />);

    // Only the password is required; empty userId → new-user login.
    await fireEvent.changeText(getByPlaceholderText('비밀번호'), 'x');
    await fireEvent.press(getByText('로그인'));

    expect(onLogin).toHaveBeenCalledWith(undefined);
  });

  it('explains an empty password with a toast instead of submitting', async () => {
    const onLogin = jest.fn();
    const { getByText } = await render(
      <ToastProvider>
        <LoginScreen onLogin={onLogin} />
      </ToastProvider>,
    );

    await fireEvent.press(getByText('로그인'));

    expect(getByText('비밀번호를 입력해주세요')).toBeTruthy();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('offers 카카오·애플·구글 social login (spec lineup, no 네이버)', async () => {
    const { getByLabelText, queryByLabelText } = await render(<LoginScreen />);

    expect(getByLabelText('Kakao로 시작')).toBeTruthy();
    expect(getByLabelText('Apple로 시작')).toBeTruthy();
    expect(getByLabelText('Google로 시작')).toBeTruthy();
    expect(queryByLabelText('네이버로 시작')).toBeNull();
  });

  it('구글 버튼이 onGoogleLogin을 부르고 성공 시 onAuthSuccess (#489)', async () => {
    const onGoogleLogin = jest.fn(async () => 'ok' as const);
    const onAuthSuccess = jest.fn();
    const { getByLabelText } = await render(
      <LoginScreen onGoogleLogin={onGoogleLogin} onAuthSuccess={onAuthSuccess} />,
    );
    await fireEvent.press(getByLabelText('Google로 시작'));
    expect(onGoogleLogin).toHaveBeenCalledTimes(1);
    expect(onAuthSuccess).toHaveBeenCalledTimes(1);
  });

  it('구글 로그인 취소는 조용히, 실패는 에러 문구 (#489)', async () => {
    const onAuthSuccess = jest.fn();
    const cancelled = await render(
      <LoginScreen onGoogleLogin={async () => 'cancelled'} onAuthSuccess={onAuthSuccess} />,
    );
    await fireEvent.press(cancelled.getByLabelText('Google로 시작'));
    expect(onAuthSuccess).not.toHaveBeenCalled();
    expect(cancelled.queryByText(/구글 로그인에 실패했어요/)).toBeNull();

    const failed = await render(
      <LoginScreen onGoogleLogin={async () => 'failed'} onAuthSuccess={onAuthSuccess} />,
    );
    await fireEvent.press(failed.getByLabelText('Google로 시작'));
    expect(onAuthSuccess).not.toHaveBeenCalled();
    expect(failed.getByText(/구글 로그인에 실패했어요/)).toBeTruthy();
  });

  it('카카오 버튼이 onKakaoLogin을 부르고 성공 시 onAuthSuccess (#489 소셜 2차)', async () => {
    const onKakaoLogin = jest.fn(async () => 'ok' as const);
    const onAuthSuccess = jest.fn();
    const { getByLabelText } = await render(
      <LoginScreen onKakaoLogin={onKakaoLogin} onAuthSuccess={onAuthSuccess} />,
    );
    await fireEvent.press(getByLabelText('Kakao로 시작'));
    expect(onKakaoLogin).toHaveBeenCalledTimes(1);
    expect(onAuthSuccess).toHaveBeenCalledTimes(1);
  });

  it('카카오 실패는 에러 문구, 취소는 조용히 (#489)', async () => {
    const failed = await render(<LoginScreen onKakaoLogin={async () => 'failed'} />);
    await fireEvent.press(failed.getByLabelText('Kakao로 시작'));
    expect(failed.getByText(/카카오 로그인에 실패했어요/)).toBeTruthy();

    const cancelled = await render(<LoginScreen onKakaoLogin={async () => 'cancelled'} />);
    await fireEvent.press(cancelled.getByLabelText('Kakao로 시작'));
    expect(cancelled.queryByText(/카카오 로그인에 실패했어요/)).toBeNull();
  });

  it('애플 버튼이 onAppleLogin을 부르고 성공 시 onAuthSuccess (#489 소셜 3차)', async () => {
    const onAppleLogin = jest.fn(async () => 'ok' as const);
    const onAuthSuccess = jest.fn();
    const { getByLabelText } = await render(
      <LoginScreen onAppleLogin={onAppleLogin} onAuthSuccess={onAuthSuccess} />,
    );
    await fireEvent.press(getByLabelText('Apple로 시작'));
    expect(onAppleLogin).toHaveBeenCalledTimes(1);
    expect(onAuthSuccess).toHaveBeenCalledTimes(1);
  });

  it('애플 실패는 에러 문구, 취소는 조용히 (#489)', async () => {
    const failed = await render(<LoginScreen onAppleLogin={async () => 'failed'} />);
    await fireEvent.press(failed.getByLabelText('Apple로 시작'));
    expect(failed.getByText(/애플 로그인에 실패했어요/)).toBeTruthy();

    const cancelled = await render(<LoginScreen onAppleLogin={async () => 'cancelled'} />);
    await fireEvent.press(cancelled.getByLabelText('Apple로 시작'));
    expect(cancelled.queryByText(/애플 로그인에 실패했어요/)).toBeNull();
  });

  it('does not show the dev-login hint', async () => {
    const { queryByText } = await render(<LoginScreen />);
    expect(queryByText(/개발 로그인/)).toBeNull();
  });

  it('이메일 가입 잠정 제외 — 회원가입 진입 링크가 없다', async () => {
    const { queryByText } = await render(<LoginScreen onGoSignup={jest.fn()} />);
    expect(queryByText('회원가입')).toBeNull();
    expect(queryByText(/아직 회원이 아니신가요/)).toBeNull();
  });
});

// 최근 로그인 배지 (#489 후속) — 마지막으로 성공한 소셜 로그인 버튼에 붙는다.
describe('LoginScreen 최근 로그인 배지', () => {
  it('lastLoginProvider와 일치하는 버튼에만 배지가 붙는다', async () => {
    const { getByText, getByLabelText } = await render(<LoginScreen lastLoginProvider="kakao" />);
    expect(getByText('최근 로그인')).toBeTruthy();
    // 접근성 라벨에도 최근 로그인이 실린다 — 스크린리더 사용자도 같은 정보.
    expect(getByLabelText('Kakao로 시작, 최근 로그인')).toBeTruthy();
    expect(getByLabelText('Google로 시작')).toBeTruthy();
  });

  it('프로바이더가 없으면 배지가 없다', async () => {
    const { queryByText } = await render(<LoginScreen />);
    expect(queryByText('최근 로그인')).toBeNull();
  });

  it('애플 프로바이더면 애플 버튼에 배지가 붙는다 (jest는 iOS)', async () => {
    const { getByLabelText } = await render(<LoginScreen lastLoginProvider="apple" />);
    expect(getByLabelText('Apple로 시작, 최근 로그인')).toBeTruthy();
  });
});
