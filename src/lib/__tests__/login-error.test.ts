/**
 * 배포본에서만 나는 로그인 장애는 재현이 안 된다 (서명 키가 달라 개발
 * 빌드에서 같은 증상이 안 난다). 원격 신호가 유일한 단서인데 종전엔
 * `catch {}` 가 그걸 지웠다 (#959).
 */
import {
  clearLoginFailure,
  describeLoginError,
  getLastLoginFailure,
  loginErrorMessage,
  rememberLoginFailure,
} from '@/lib/login-error';

describe('describeLoginError (#959)', () => {
  it('DEVELOPER_ERROR는 서명 문제라고 사람 말로 옮긴다', () => {
    // Android에서 SHA-1/패키지명이 콘솔과 안 맞을 때 나는 코드. Play 앱 서명은
    // 업로드 키와 지문이 달라 배포본에서만 터진다 — 이 힌트가 며칠을 아낀다.
    expect(describeLoginError({ code: 10 })).toMatchObject({
      code: '10',
      hint: expect.stringContaining('서명'),
    });
    expect(describeLoginError({ code: 'DEVELOPER_ERROR' }).hint).toContain('서명');
  });

  it('모르는 코드는 코드만 남기고 힌트는 비운다 — 지어내지 않는다', () => {
    expect(describeLoginError({ code: 'WAT', message: '뭔가 잘못됨' })).toEqual({
      code: 'WAT',
      message: '뭔가 잘못됨',
      hint: undefined,
    });
  });

  it('어떤 모양의 에러가 와도 던지지 않는다', () => {
    for (const bad of [null, undefined, 'string', 42, new Error('boom')]) {
      expect(() => describeLoginError(bad)).not.toThrow();
    }
    expect(describeLoginError(new Error('boom')).message).toBe('boom');
    expect(describeLoginError(null).code).toBeUndefined();
  });

  it('긴 메시지는 잘라 보낸다 — 분석 파라미터 상한이 있다', () => {
    const long = 'x'.repeat(500);
    expect((describeLoginError({ message: long }).message ?? '').length).toBeLessThanOrEqual(120);
  });
});

describe('loginErrorMessage (#959)', () => {
  it('코드가 있으면 문구 뒤에 붙인다 — 스크린샷 한 장으로 원인이 갈린다', () => {
    expect(loginErrorMessage('구글 로그인에 실패했어요.', { code: '10' })).toBe(
      '구글 로그인에 실패했어요. (10)',
    );
  });

  it('코드가 없으면 문구를 건드리지 않는다', () => {
    expect(loginErrorMessage('실패했어요.', {})).toBe('실패했어요.');
  });
});

describe('마지막 실패 보관 (#959)', () => {
  it('기록했다가 성공하면 지운다 — 다음 실패에 옛 코드가 붙으면 안 된다', () => {
    rememberLoginFailure({ code: '10' });
    expect(getLastLoginFailure()).toMatchObject({ code: '10' });
    clearLoginFailure();
    expect(getLastLoginFailure()).toBeNull();
  });
});
