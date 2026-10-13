/**
 * @jest-environment jsdom
 *
 * 구글 웹 로그인 브라우저 배선 (#1532) — 카카오 웹처럼 페이지 리다이렉트다. 순수
 * 조각(`google-web-oauth`)은 따로 검증되고, 여기서는 sessionStorage·location을
 * 잇는 부분을 본다.
 *
 * 예전(GIS 숨은 버튼 클릭) 방식은 GIS가 버튼을 iframe에 그리면서 막혔고, 그때의
 * 테스트 스텁은 `div[role=button]`을 그려 그 변화를 못 잡았다.
 */
import { URL as NodeURL, URLSearchParams as NodeURLSearchParams } from 'node:url';

import { GOOGLE_WEB_CLIENT_ID } from '@/lib/oauth-client-ids';

beforeAll(() => {
  Object.assign(globalThis, { URL: NodeURL, URLSearchParams: NodeURLSearchParams });
});

type GoogleAuthWeb = typeof import('@/lib/google-auth.web');

const STATE_KEY = 'rougether.google-web.state';
const NONCE_KEY = 'rougether.google-web.nonce';
const ORIGIN = 'http://localhost';

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'RS256' })}.${b64(payload)}.sig`;
}

function setLocation(hash: string) {
  window.history.replaceState(null, '', `/login${hash}`);
}

function loadModule(): GoogleAuthWeb {
  let mod!: GoogleAuthWeb;
  // 동적 import는 jest(CommonJS)에서 --experimental-vm-modules가 필요해 require로.
  jest.isolateModules(() => {
    mod = jest.requireActual('@/lib/google-auth.web') as GoogleAuthWeb;
  });
  return mod;
}

afterEach(() => {
  window.sessionStorage.clear();
  setLocation('');
});

describe('getGoogleIdToken (web, 리다이렉트)', () => {
  it('일반 진입이면 state·nonce를 저장하고 구글 인가 페이지로 떠난다 (끝나지 않는 Promise)', async () => {
    const assign = jest.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, origin: ORIGIN, hash: '', href: `${ORIGIN}/login`, assign },
    });
    try {
      const { getGoogleIdToken } = loadModule();
      void getGoogleIdToken();
      await Promise.resolve();
      expect(assign).toHaveBeenCalledTimes(1);
      const url = new URL(assign.mock.calls[0][0] as string);
      expect(url.host).toBe('accounts.google.com');
      expect(url.searchParams.get('client_id')).toBe(GOOGLE_WEB_CLIENT_ID);
      expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/login`);
      expect(url.searchParams.get('state')).toBe(window.sessionStorage.getItem(STATE_KEY));
      expect(url.searchParams.get('nonce')).toBe(window.sessionStorage.getItem(NONCE_KEY));
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('복귀 진입이면 id token을 돌려주고, 주소의 토큰과 state·nonce를 지운다', async () => {
    const token = jwt({ nonce: 'n1' });
    window.sessionStorage.setItem(STATE_KEY, 's1');
    window.sessionStorage.setItem(NONCE_KEY, 'n1');
    setLocation(`#id_token=${token}&state=s1`);
    const { getGoogleIdToken, hasGoogleRedirect } = loadModule();

    expect(hasGoogleRedirect()).toBe(true);
    await expect(getGoogleIdToken()).resolves.toBe(token);
    expect(window.location.hash).toBe('');
    expect(window.sessionStorage.getItem(STATE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(NONCE_KEY)).toBeNull();
    // 새로고침해도 같은 토큰을 다시 쓰지 않는다.
    expect(hasGoogleRedirect()).toBe(false);
  });

  it('동의 화면 취소는 null(에러 아님)', async () => {
    window.sessionStorage.setItem(STATE_KEY, 's1');
    window.sessionStorage.setItem(NONCE_KEY, 'n1');
    setLocation('#error=access_denied&state=s1');
    await expect(loadModule().getGoogleIdToken()).resolves.toBeNull();
  });

  it('state·nonce가 안 맞으면 throw — 그래도 복귀 파라미터는 걷어낸다', async () => {
    window.sessionStorage.setItem(STATE_KEY, 's1');
    window.sessionStorage.setItem(NONCE_KEY, 'n1');
    setLocation(`#id_token=${jwt({ nonce: 'other' })}&state=s1`);
    const { getGoogleIdToken, hasGoogleRedirect } = loadModule();
    await expect(getGoogleIdToken()).rejects.toThrow('nonce mismatch');
    expect(hasGoogleRedirect()).toBe(false);

    window.sessionStorage.setItem(STATE_KEY, 's1');
    setLocation(`#id_token=${jwt({ nonce: 'n1' })}&state=forged`);
    await expect(getGoogleIdToken()).rejects.toThrow('state mismatch');
  });
});
