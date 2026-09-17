import * as Sentry from '@sentry/react-native';

import {
  clearErrorUser,
  initErrorReporting,
  reportError,
  setErrorLanguage,
  setErrorUser,
} from '@/lib/error-reporting';

describe('error-reporting (#801)', () => {
  it('초기화가 실패해도 전 함수가 조용히 무동작한다', () => {
    // 분석과 같은 계약 — 리포팅이 앱을 죽이면 안 된다.
    (Sentry.init as jest.Mock).mockImplementationOnce(() => {
      throw new Error('native module missing');
    });
    expect(() => {
      initErrorReporting();
      setErrorUser(4);
      reportError(new Error('boom'), { where: 'test' });
      clearErrorUser();
    }).not.toThrow();
  });

  it('사용자 식별은 서버 회원 id만 붙인다 — 개인정보를 싣지 않는다', () => {
    setErrorUser(42);
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: '42' });

    clearErrorUser();
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });

  it('삼켜지는 예외를 컨텍스트와 함께 남긴다', () => {
    reportError('문자열 에러', { screen: 'myRoom' });
    const call = (Sentry.captureException as jest.Mock).mock.calls.at(-1);
    expect(call?.[0]).toBeInstanceOf(Error);
    expect(call?.[1]).toMatchObject({ extra: { screen: 'myRoom' } });
  });

  it('앱 언어를 태그로 남긴다 (#1369)', () => {
    setErrorLanguage('en');
    expect(Sentry.setTag).toHaveBeenCalledWith('app_language', 'en');
  });
});

describe('레인·샘플링·URL 정리 (#1376)', () => {
  const { resolveReportingLane, scrubUrl, isApiRequest, PRODUCTION_TRACES_SAMPLE_RATE } =
    jest.requireActual('@/lib/error-reporting') as typeof import('@/lib/error-reporting');

  it('네이티브 채널로 레인을 가른다 — dev 채널은 재배선 뒤 스토어 레인이라 운영', () => {
    expect(resolveReportingLane('ios', 'production', undefined)).toEqual({
      environment: 'production',
      tracesSampleRate: PRODUCTION_TRACES_SAMPLE_RATE,
      channel: 'production',
    });
    expect(resolveReportingLane('android', 'dev', undefined).environment).toBe('production');
    expect(resolveReportingLane('ios', 'internal', undefined)).toMatchObject({
      environment: 'internal',
      tracesSampleRate: 1,
    });
    expect(resolveReportingLane('ios', null, undefined)).toMatchObject({
      environment: 'unknown',
      channel: 'none',
    });
  });

  it('웹은 운영 호스트만 web-production, 나머지는 web-dev', () => {
    expect(resolveReportingLane('web', null, 'app.rougether.com')).toEqual({
      environment: 'web-production',
      tracesSampleRate: PRODUCTION_TRACES_SAMPLE_RATE,
      channel: 'web',
    });
    expect(resolveReportingLane('web', null, 'localhost').environment).toBe('web-dev');
  });

  it('URL의 쿼리·해시를 지우고 숫자 id를 {id}로 — 초대코드·날짜가 Sentry로 가지 않게', () => {
    expect(scrubUrl('https://api.example.com/api/v1/houses/12/members/345?code=ABCD#x')).toBe(
      'https://api.example.com/api/v1/houses/{id}/members/{id}',
    );
    expect(scrubUrl('https://api.example.com/api/v1/routines/9')).toBe(
      'https://api.example.com/api/v1/routines/{id}',
    );
    // 초대코드·UUID 같은 영숫자 식별자도 지운다 — 진단 기록·GA4와 같은 규칙.
    expect(scrubUrl('https://api.example.com/api/v1/invites/AB12CD/join')).toBe(
      'https://api.example.com/api/v1/invites/{id}/join',
    );
    expect(
      scrubUrl('https://api.example.com/api/v1/items/3f2b8c1e-0a4d-4e5f-9b6a-1c2d3e4f5a6b'),
    ).toBe('https://api.example.com/api/v1/items/{id}');
    // 이름 속 숫자는 건드리지 않는다.
    expect(scrubUrl('https://cdn.example.com/items/v2/icon123.png')).toBe(
      'https://cdn.example.com/items/v2/icon123.png',
    );
  });

  it('스팬은 우리 API 요청에만 만든다', () => {
    const { API_BASE } = jest.requireActual('@/api/config') as typeof import('@/api/config');
    expect(isApiRequest(`${API_BASE}/routines`)).toBe(true);
    expect(isApiRequest('https://kapi.kakao.com/v2/user/me')).toBe(false);
  });

  it('초기화는 트레이스 헤더 전파를 끄고, 레인 태그와 내비게이션 통합을 붙인다', () => {
    // 첫 테스트에서 초기화가 실패해 started가 풀려 있다 — 여기서 실제 초기화가 한 번 돈다.
    (Sentry.init as jest.Mock).mockClear();
    initErrorReporting();
    const options = (Sentry.init as jest.Mock).mock.calls.at(-1)?.[0];
    // 서버 CORS가 sentry-trace·baggage를 허용하지 않아 웹 preflight가 막힌다.
    expect(options.tracePropagationTargets).toEqual([]);
    expect(options.sendDefaultPii).toBe(false);
    expect(typeof options.tracesSampleRate).toBe('number');
    expect(Sentry.reactNavigationIntegration).toHaveBeenCalled();
    expect(Sentry.setTag).toHaveBeenCalledWith('channel', expect.any(String));
  });
});
