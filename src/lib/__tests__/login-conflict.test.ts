import { ApiError } from '@/api/http';
import {
  conflictMessage,
  isLoginConflict,
  parseLoginConflict,
  providerLabel,
} from '@/lib/login-conflict';

const conflictError = (body: unknown) =>
  new ApiError(409, 'POST', '/auth/kakao', JSON.stringify(body));

describe('parseLoginConflict — 같은 이메일 타 provider 안내(409)', () => {
  it('providers 를 소문자 SocialProvider 로, 서버 문구를 message 로 뽑는다', () => {
    const parsed = parseLoginConflict(
      conflictError({
        code: 'AUTH_EMAIL_LINKED_TO_OTHER_PROVIDER',
        message: '이 이메일은 애플 로그인으로 가입되어 있어요.',
        details: { providers: ['APPLE'] },
      }),
    );
    expect(parsed).toEqual({
      providers: ['apple'],
      message: '이 이메일은 애플 로그인으로 가입되어 있어요.',
    });
  });

  it('모르는 provider 는 거르고, 문구가 없으면 폴백 문구를 만든다', () => {
    const parsed = parseLoginConflict(
      conflictError({
        code: 'AUTH_EMAIL_LINKED_TO_OTHER_PROVIDER',
        details: { providers: ['GOOGLE', 'NAVER', 42] },
      }),
    );
    expect(parsed).toEqual({
      providers: ['google'],
      message: '이 이메일은 구글 로그인으로 가입되어 있어요.',
    });
  });

  it('다른 에러(코드 불일치·ApiError 아님)는 null', () => {
    expect(
      parseLoginConflict(conflictError({ code: 'AUTH_OAUTH_KAKAO_TOKEN_INVALID' })),
    ).toBeNull();
    expect(parseLoginConflict(new Error('network'))).toBeNull();
    expect(parseLoginConflict(undefined)).toBeNull();
  });
});

describe('labels', () => {
  it('provider 라벨과 폴백 문구', () => {
    expect(providerLabel('kakao')).toBe('카카오');
    expect(conflictMessage(['apple', 'google'])).toBe(
      '이 이메일은 애플·구글 로그인으로 가입되어 있어요.',
    );
    expect(conflictMessage([])).toBe('이 이메일은 다른 소셜 로그인으로 가입되어 있어요.');
  });

  it('isLoginConflict 는 객체 결과만 참', () => {
    expect(isLoginConflict('ok')).toBe(false);
    expect(
      isLoginConflict({
        status: 'conflict',
        providers: ['apple'],
        message: 'm',
        continueAsNew: async () => 'ok' as const,
      }),
    ).toBe(true);
  });
});
