import { URL as NodeURL, URLSearchParams as NodeURLSearchParams } from 'node:url';

import {
  buildGoogleAuthorizeUrl,
  idTokenNonce,
  parseGoogleRedirect,
  stripGoogleFragment,
} from '@/lib/google-web-oauth';

// jest-expo 프리셋의 RN URL 스텁 대신 실제 구현 (kakao-web-oauth 테스트와 같은 이유).
beforeAll(() => {
  Object.assign(globalThis, { URL: NodeURL, URLSearchParams: NodeURLSearchParams });
});

/** 서명 없는 테스트용 JWT — 클라이언트는 nonce 대조만 하고 서명 검증은 서버 몫이다. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'RS256' })}.${b64(payload)}.sig`;
}

const expected = { state: 's1', nonce: 'n1' };

describe('google web oauth (#1532)', () => {
  it('인가 URL은 id token만, 매번 계정 선택, state·nonce를 싣는다', () => {
    const url = new URL(
      buildGoogleAuthorizeUrl({
        clientId: 'web-client',
        redirectUri: 'https://app.rougether.com/login',
        state: 's1',
        nonce: 'n1',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'web-client',
      redirect_uri: 'https://app.rougether.com/login',
      response_type: 'id_token',
      scope: 'openid email profile',
      state: 's1',
      nonce: 'n1',
      prompt: 'select_account',
    });
  });

  it('구글 파라미터가 없는 프래그먼트는 일반 진입(null)', () => {
    expect(parseGoogleRedirect('', expected)).toBeNull();
    expect(parseGoogleRedirect('#section', expected)).toBeNull();
  });

  it('state·nonce가 맞으면 id token을 돌려준다', () => {
    const token = jwt({ nonce: 'n1', aud: 'web-client' });
    expect(parseGoogleRedirect(`#id_token=${token}&state=s1`, expected)).toEqual({
      kind: 'token',
      idToken: token,
    });
  });

  it('state가 다르거나 저장된 state가 없으면 거부(CSRF)', () => {
    const token = jwt({ nonce: 'n1' });
    expect(parseGoogleRedirect(`#id_token=${token}&state=other`, expected)).toEqual({
      kind: 'state_mismatch',
    });
    expect(
      parseGoogleRedirect(`#id_token=${token}&state=s1`, { state: null, nonce: 'n1' }),
    ).toEqual({ kind: 'state_mismatch' });
  });

  it('토큰의 nonce가 다르면 거부(재사용 토큰)', () => {
    const token = jwt({ nonce: 'old' });
    expect(parseGoogleRedirect(`#id_token=${token}&state=s1`, expected)).toEqual({
      kind: 'nonce_mismatch',
    });
  });

  it('동의 화면 취소는 cancelled, 그 밖의 오류는 error', () => {
    expect(parseGoogleRedirect('#error=access_denied&state=s1', expected)).toEqual({
      kind: 'cancelled',
    });
    expect(parseGoogleRedirect('#error=invalid_request&state=s1', expected)).toEqual({
      kind: 'error',
      error: 'invalid_request',
    });
  });

  it('nonce는 base64url 본문에서 읽고, 깨진 토큰이면 null', () => {
    expect(idTokenNonce(jwt({ nonce: '한글-nonce', name: '이름' }))).toBe('한글-nonce');
    expect(idTokenNonce('not-a-jwt')).toBeNull();
    expect(idTokenNonce('a.@@@.c')).toBeNull();
  });

  it('복귀 주소에서 프래그먼트만 걷어낸다', () => {
    expect(stripGoogleFragment('https://app.rougether.com/login?x=1#id_token=t&state=s')).toBe(
      'https://app.rougether.com/login?x=1',
    );
  });
});
