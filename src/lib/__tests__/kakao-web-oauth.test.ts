/**
 * 카카오 웹 로그인의 순수 조각 — 인가 URL·복귀 파싱·토큰 본문·주소 정리.
 * 브라우저 배선(`kakao-auth.web.ts`)은 웹 번들에서만 살아 여기서 다루지 않는다.
 */
import {
  buildKakaoAuthorizeUrl,
  buildKakaoTokenBody,
  KAKAO_AUTHORIZE_URL,
  parseKakaoRedirect,
  stripKakaoParams,
} from '@/lib/kakao-web-oauth';

const base = { restApiKey: 'rest-key', redirectUri: 'https://app.rougether.com/login' };

test('인가 URL은 REST 키·redirect_uri·code 응답·state를 담는다', () => {
  const url = new URL(buildKakaoAuthorizeUrl({ ...base, state: 'abc' }));
  expect(`${url.origin}${url.pathname}`).toBe(KAKAO_AUTHORIZE_URL);
  expect(url.searchParams.get('client_id')).toBe('rest-key');
  expect(url.searchParams.get('redirect_uri')).toBe(base.redirectUri);
  expect(url.searchParams.get('response_type')).toBe('code');
  expect(url.searchParams.get('state')).toBe('abc');
});

test('복귀 파싱: 카카오 파라미터가 없으면 null(일반 진입)', () => {
  expect(parseKakaoRedirect('', 'abc')).toBeNull();
  expect(parseKakaoRedirect('?utm_source=ig', 'abc')).toBeNull();
});

test('복귀 파싱: state가 맞으면 코드를 준다', () => {
  expect(parseKakaoRedirect('?code=C1&state=abc', 'abc')).toEqual({ kind: 'code', code: 'C1' });
});

test('복귀 파싱: state 불일치·부재는 코드를 쓰지 않는다(CSRF)', () => {
  expect(parseKakaoRedirect('?code=C1&state=zzz', 'abc')).toEqual({ kind: 'state_mismatch' });
  expect(parseKakaoRedirect('?code=C1&state=abc', null)).toEqual({ kind: 'state_mismatch' });
});

test('복귀 파싱: 사용자가 동의 화면에서 취소하면 cancelled, 그 외 오류는 error', () => {
  expect(parseKakaoRedirect('?error=access_denied&state=abc', 'abc')).toEqual({
    kind: 'cancelled',
  });
  expect(parseKakaoRedirect('?error=server_error&state=abc', 'abc')).toEqual({
    kind: 'error',
    error: 'server_error',
  });
});

test('토큰 교환 본문은 authorization_code 그랜트에 같은 redirect_uri를 실어 보낸다', () => {
  const body = buildKakaoTokenBody({ ...base, code: 'C1' });
  expect(body.get('grant_type')).toBe('authorization_code');
  expect(body.get('client_id')).toBe('rest-key');
  expect(body.get('redirect_uri')).toBe(base.redirectUri);
  expect(body.get('code')).toBe('C1');
});

test('주소 정리는 카카오 파라미터만 걷어내고 나머지 쿼리는 남긴다', () => {
  expect(
    stripKakaoParams('https://app.rougether.com/login?utm_source=ig&code=C1&state=abc&error=x'),
  ).toBe('https://app.rougether.com/login?utm_source=ig');
});
