import * as Sentry from '@sentry/react-native';

import {
  clearErrorUser,
  initErrorReporting,
  reportError,
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
});
