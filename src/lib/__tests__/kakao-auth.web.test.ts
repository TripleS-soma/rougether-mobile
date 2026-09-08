/**
 * @jest-environment jsdom
 *
 * 카카오 웹 로그인 브라우저 배선 (#1225 리뷰) — 순수 조각(`kakao-web-oauth`)은
 * 따로 검증되고, 여기서는 sessionStorage·location·fetch를 잇는 부분을 본다.
 * REST 키는 모듈 로드 시 읽히므로 각 테스트가 env를 세팅한 뒤 새로 import한다.
 */
import { URL as NodeURL, URLSearchParams as NodeURLSearchParams } from 'node:url';

// jest-expo 프리셋이 RN의 URL·URLSearchParams 스텁을 전역에 심는다(객체 인자를
// 받으면 throw). 브라우저 배선 테스트는 실제 구현이 필요해 Node 것으로 되돌린다.
beforeAll(() => {
  Object.assign(globalThis, { URL: NodeURL, URLSearchParams: NodeURLSearchParams });
});

type KakaoAuthWeb = typeof import('@/lib/kakao-auth.web');

const STATE_KEY = 'rougether.kakao-web.state';
const ORIGIN = 'http://localhost';

function setLocation(search: string) {
  window.history.replaceState(null, '', `/login${search}`);
}

function loadModule(restKey: string | undefined): KakaoAuthWeb {
  if (restKey === undefined) delete process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
  else process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY = restKey;
  let mod!: KakaoAuthWeb;
  // 동적 import는 jest(CommonJS)에서 --experimental-vm-modules가 필요해 require로.
  jest.isolateModules(() => {
    mod = jest.requireActual('@/lib/kakao-auth.web') as KakaoAuthWeb;
  });
  return mod;
}

describe('getKakaoAccessToken (web)', () => {
  const originalEnv = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
  const globalWithFetch = globalThis as { fetch?: unknown };
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
    else process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY = originalEnv;
    window.sessionStorage.clear();
    setLocation('');
    delete globalWithFetch.fetch;
    jest.restoreAllMocks();
  });

  it('복귀 진입이면 코드를 access token으로 바꾸고 URL·state를 정리한다', async () => {
    window.sessionStorage.setItem(STATE_KEY, 's1');
    setLocation('?code=abc&state=s1');
    // jsdom 환경엔 fetch가 없다 — 토큰 교환 응답만 흉내 낸다.
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'kakao-token' }),
    });
    globalWithFetch.fetch = fetchSpy;
    const { getKakaoAccessToken, hasKakaoRedirect } = loadModule('rest-key');
    expect(hasKakaoRedirect()).toBe(true);
    await expect(getKakaoAccessToken()).resolves.toBe('kakao-token');
    const body = fetchSpy.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get('code')).toBe('abc');
    expect(body.get('redirect_uri')).toBe(`${ORIGIN}/login`);
    expect(window.location.search).toBe('');
    expect(window.sessionStorage.getItem(STATE_KEY)).toBeNull();
    expect(hasKakaoRedirect()).toBe(false);
  });

  it('키가 안 실린 배포에서도 복귀 파라미터를 먼저 걷어내고 throw — 복귀 효과가 매 렌더 재시도하지 않게', async () => {
    window.sessionStorage.setItem(STATE_KEY, 's1');
    setLocation('?code=abc&state=s1');
    const { getKakaoAccessToken, hasKakaoRedirect } = loadModule(undefined);
    await expect(getKakaoAccessToken()).rejects.toThrow('EXPO_PUBLIC_KAKAO_REST_API_KEY');
    expect(window.location.search).toBe('');
    expect(hasKakaoRedirect()).toBe(false);
  });

  it('동의 화면에서 취소하고 돌아오면 null (에러 아님)', async () => {
    window.sessionStorage.setItem(STATE_KEY, 's1');
    setLocation('?error=access_denied&state=s1');
    const { getKakaoAccessToken } = loadModule('rest-key');
    await expect(getKakaoAccessToken()).resolves.toBeNull();
    expect(window.location.search).toBe('');
  });

  it('일반 진입이면 state를 저장하고 kauth로 떠난다 (끝나지 않는 Promise)', async () => {
    const assign = jest.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, origin: ORIGIN, search: '', href: `${ORIGIN}/login`, assign },
    });
    try {
      const { getKakaoAccessToken } = loadModule('rest-key');
      void getKakaoAccessToken();
      await Promise.resolve();
      expect(assign).toHaveBeenCalledTimes(1);
      const url = new URL(assign.mock.calls[0][0] as string);
      expect(url.origin).toBe('https://kauth.kakao.com');
      expect(url.searchParams.get('client_id')).toBe('rest-key');
      expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/login`);
      expect(url.searchParams.get('state')).toBe(window.sessionStorage.getItem(STATE_KEY));
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});
