import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import Login from '@/app/login';

/**
 * 로그인 라우트 — 로그인 전 소개 게이팅과 계측 (#1282).
 *
 * 설치 후 로그인 전에 46%가 떠났다(#1045). 소개가 그 자리에 들어가고, 소개 ·
 * 로그인 화면 · 버튼 탭 · 취소가 각각 남아야 어디서 떠나는지 가를 수 있다.
 */
const mockTrack = jest.fn();
const mockReplace = jest.fn();
const mockKakao = jest.fn();
const mockGoogle = jest.fn();
let mockRedirect = false;

jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock('@/lib/analytics', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));
jest.mock('@/lib/kakao-auth', () => ({ hasKakaoRedirect: () => mockRedirect }));
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

const INTRO_KEY = 'rougether.intro-seen.v1';
const events = (name: string) => mockTrack.mock.calls.filter(([e]) => e === name);

beforeEach(async () => {
  await AsyncStorage.clear();
  mockTrack.mockClear();
  mockReplace.mockClear();
  mockKakao.mockReset();
  mockGoogle.mockReset();
  mockRedirect = false;
});

describe('로그인 전 소개 (#1282)', () => {
  it('처음 온 기기는 로그인 화면보다 소개가 먼저다', async () => {
    const ui = await render(<Login />);
    await waitFor(() => expect(ui.getByText('루게더에 오신 걸 환영해요')).toBeTruthy());
    expect(ui.queryByText('Kakao로 시작하기')).toBeNull();
    expect(events('intro_view')).toEqual([['intro_view', { step: 'my-room', index: 0 }]]);
    // 로그인 화면은 아직 안 봤다.
    expect(events('login_view')).toEqual([]);
  });

  it('끝까지 보고 시작하기 → 로그인 화면, 다음 진입엔 소개가 없다', async () => {
    const ui = await render(<Login />);
    await waitFor(() => expect(ui.getByText('루게더에 오신 걸 환영해요')).toBeTruthy());
    for (let i = 0; i < 4; i += 1) await fireEvent.press(ui.getByText('다음'));
    await fireEvent.press(ui.getByText('시작하기'));

    expect(ui.getByText('Kakao로 시작하기')).toBeTruthy();
    expect(events('intro_view').map(([, p]) => (p as { step: string }).step)).toEqual([
      'my-room',
      'routines',
      'decor',
      'house',
      'calendar',
    ]);
    expect(events('intro_complete')).toHaveLength(1);
    expect(events('login_view')).toEqual([['login_view', { via: 'intro' }]]);
    await waitFor(async () => expect(await AsyncStorage.getItem(INTRO_KEY)).toBe('1'));

    // 로그아웃 뒤 다시 온 것처럼 — 기록이 남아 곧장 로그인.
    await ui.unmount();
    mockTrack.mockClear();
    const again = await render(<Login />);
    await waitFor(() => expect(again.getByText('Kakao로 시작하기')).toBeTruthy());
    expect(events('intro_view')).toEqual([]);
    expect(events('login_view')).toEqual([['login_view', { via: 'direct' }]]);
  });

  it("첫 장 '이미 계정이 있어요' → 로그인 화면, 기록도 남는다", async () => {
    const ui = await render(<Login />);
    await waitFor(() => expect(ui.getByText('이미 계정이 있어요')).toBeTruthy());
    await fireEvent.press(ui.getByText('이미 계정이 있어요'));

    expect(ui.getByText('Kakao로 시작하기')).toBeTruthy();
    expect(events('intro_have_account')).toHaveLength(1);
    expect(events('intro_complete')).toEqual([]);
    expect(events('login_view')).toEqual([['login_view', { via: 'have_account' }]]);
    await waitFor(async () => expect(await AsyncStorage.getItem(INTRO_KEY)).toBe('1'));
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

  it('웹 카카오 복귀 중에는 소개를 건너뛰고 교환을 이어간다', async () => {
    mockRedirect = true;
    consumeRedirect('ok');
    const ui = await render(<Login />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(ui.queryByText('루게더에 오신 걸 환영해요')).toBeNull();
    expect(events('intro_view')).toEqual([]);
    expect(events('login_view')).toEqual([['login_view', { via: 'kakao_redirect' }]]);
    // 복귀 교환은 버튼 탭이 아니다 — 탭은 떠나기 전에 이미 셌다.
    expect(events('login_tap')).toEqual([]);
  });

  it('웹 카카오 복귀가 취소면 취소로 남기고, 소개를 안 봤어도 로그인 화면에 머문다', async () => {
    mockRedirect = true;
    consumeRedirect('cancelled');
    const ui = await render(<Login />);
    await waitFor(() =>
      expect(events('login_cancel')).toEqual([['login_cancel', { provider: 'kakao' }]]),
    );
    // 저장소엔 소개 기록이 없다 — 뒤늦은 저장소 값이 복귀 판정을 덮으면 소개가 뜬다.
    expect(await AsyncStorage.getItem(INTRO_KEY)).toBeNull();
    expect(ui.getByText('Kakao로 시작하기')).toBeTruthy();
    expect(ui.queryByText('루게더에 오신 걸 환영해요')).toBeNull();
    expect(events('login_view')).toEqual([['login_view', { via: 'kakao_redirect' }]]);
  });
});

describe('로그인 버튼 계측 (#1282)', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem(INTRO_KEY, '1');
  });

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
