import { fireEvent, render, waitFor } from '@testing-library/react-native';

import Login from '@/app/login';

/**
 * 로그인 라우트 — 첫 화면과 계측 (#1282, #1700).
 *
 * 설치 후 로그인 전에 46%가 떠났다(#1045). 로그인 화면 · 버튼 탭 · 취소가 각각
 * 남아야 어디서 떠나는지 가를 수 있다. 로그인 전 소개 슬라이드는 #1700에서 없앴다 —
 * 앱을 열면 곧장 로그인 화면이다.
 */
const mockTrack = jest.fn();
const mockReplace = jest.fn();
const mockKakao = jest.fn();
const mockGoogle = jest.fn();
let mockRedirect = false;
let mockGoogleRedirect = false;

jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock('@/lib/analytics', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));
jest.mock('@/lib/kakao-auth', () => ({ hasKakaoRedirect: () => mockRedirect }));
jest.mock('@/lib/google-auth', () => ({ hasGoogleRedirect: () => mockGoogleRedirect }));
jest.mock('@/hooks/use-auth', () => {
  // 참조가 고정된 훅 반환 — 렌더마다 새 함수면 복귀 이펙트가 다시 돈다.
  const auth = {
    login: jest.fn(),
    loginWithGoogle: () => mockGoogle(),
    loginWithKakao: () => mockKakao(),
    loginWithApple: jest.fn(),
  };
  return { useAuth: () => auth };
});

const events = (name: string) => mockTrack.mock.calls.filter(([e]) => e === name);

beforeEach(() => {
  mockTrack.mockClear();
  mockReplace.mockClear();
  mockKakao.mockReset();
  mockGoogle.mockReset();
  mockRedirect = false;
});

describe('첫 화면 (#1700)', () => {
  it('앱을 열면 소개 없이 곧장 로그인 화면이다', async () => {
    const ui = await render(<Login />);
    await waitFor(() => expect(ui.getByText('Kakao로 시작하기')).toBeTruthy());
    expect(ui.queryByText('루게더에 오신 걸 환영해요')).toBeNull();
    expect(ui.queryByText('이미 계정이 있어요')).toBeNull();
    expect(events('login_view')).toEqual([['login_view', { via: 'direct' }]]);
  });

  /**
   * 실제 교환(getKakaoAccessToken)은 복귀 파라미터를 **동기적으로** 걷어낸다 —
   * 한 번 물은 뒤엔 hasKakaoRedirect가 false다. 목도 그렇게 소비시켜야 두 번째
   * 판정에 기대는 회귀를 잡는다 (#1283 리뷰).
   */
  const consumeRedirect = (result: 'ok' | 'cancelled' | 'failed') =>
    mockKakao.mockImplementation(() => {
      mockRedirect = false;
      return Promise.resolve(result);
    });

  it('웹 카카오 복귀면 교환을 이어간다', async () => {
    mockRedirect = true;
    consumeRedirect('ok');
    const ui = await render(<Login />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(ui.getByText('Kakao로 시작하기')).toBeTruthy();
    expect(events('login_view')).toEqual([['login_view', { via: 'kakao_redirect' }]]);
    // 복귀 교환은 버튼 탭이 아니다 — 탭은 떠나기 전에 이미 셌다.
    expect(events('login_tap')).toEqual([]);
  });

  it('웹 카카오 복귀가 취소면 취소로 남기고 로그인 화면에 머문다', async () => {
    mockRedirect = true;
    consumeRedirect('cancelled');
    const ui = await render(<Login />);
    await waitFor(() =>
      expect(events('login_cancel')).toEqual([['login_cancel', { provider: 'kakao' }]]),
    );
    expect(ui.getByText('Kakao로 시작하기')).toBeTruthy();
    expect(events('login_view')).toEqual([['login_view', { via: 'kakao_redirect' }]]);
  });
});

describe('로그인 버튼 계측 (#1282)', () => {
  it('탭은 제공자와 함께 남고, 취소는 따로 남는다', async () => {
    mockKakao.mockResolvedValue('cancelled');
    const ui = await render(<Login />);
    await waitFor(() => expect(ui.getByText('Kakao로 시작하기')).toBeTruthy());
    await fireEvent.press(ui.getByText('Kakao로 시작하기'));

    await waitFor(() =>
      expect(events('login_cancel')).toEqual([['login_cancel', { provider: 'kakao' }]]),
    );
    expect(events('login_tap')).toEqual([['login_tap', { provider: 'kakao' }]]);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('성공이면 취소를 남기지 않고 앱으로 간다', async () => {
    mockGoogle.mockResolvedValue('ok');
    const ui = await render(<Login />);
    await waitFor(() => expect(ui.getByText('Google로 시작하기')).toBeTruthy());
    await fireEvent.press(ui.getByText('Google로 시작하기'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(events('login_tap')).toEqual([['login_tap', { provider: 'google' }]]);
    expect(events('login_cancel')).toEqual([]);
  });
});

describe('웹 구글 리다이렉트 복귀 (#1532)', () => {
  const consumeGoogle = (result: 'ok' | 'cancelled' | 'failed') =>
    mockGoogle.mockImplementation(() => {
      mockGoogleRedirect = false;
      return Promise.resolve(result);
    });
  afterEach(() => {
    mockGoogleRedirect = false;
  });

  it('복귀면 구글 로그인을 이어서 끝낸다', async () => {
    mockGoogleRedirect = true;
    consumeGoogle('ok');
    await render(<Login />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockKakao).not.toHaveBeenCalled();
    expect(events('login_view')).toEqual([['login_view', { via: 'google_redirect' }]]);
    expect(events('login_tap')).toEqual([]);
  });

  it('복귀했는데 실패하면 구글 실패 문구를 띄우고 로그인 화면에 머문다', async () => {
    mockGoogleRedirect = true;
    consumeGoogle('failed');
    const ui = await render(<Login />);
    await waitFor(() => expect(ui.getByText(/구글 로그인에 실패했어요/)).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
