import { ApiError } from '@/api/http';

describe('ApiError.code (#557)', () => {
  it('parses the code field from a JSON error body', () => {
    const err = new ApiError(
      409,
      'POST',
      '/houses/2/join-requests',
      JSON.stringify({ code: 'HOUSE_JOIN_REQUEST_ALREADY_PENDING', message: '이미 신청 중' }),
    );
    expect(err.code).toBe('HOUSE_JOIN_REQUEST_ALREADY_PENDING');
    // bodyText stays intact for callers that still read it.
    expect(err.bodyText).toContain('HOUSE_JOIN_REQUEST_ALREADY_PENDING');
  });

  it('leaves code undefined for non-JSON, missing, or non-string bodies', () => {
    expect(new ApiError(500, 'GET', '/x', '<html>oops</html>').code).toBeUndefined();
    expect(new ApiError(500, 'GET', '/x').code).toBeUndefined();
    expect(
      new ApiError(500, 'GET', '/x', JSON.stringify({ message: 'no code' })).code,
    ).toBeUndefined();
    expect(new ApiError(500, 'GET', '/x', JSON.stringify({ code: 409 })).code).toBeUndefined();
  });

  it('parses the human message and structured details when present', () => {
    const err = new ApiError(
      409,
      'POST',
      '/auth/kakao',
      JSON.stringify({
        code: 'AUTH_EMAIL_LINKED_TO_OTHER_PROVIDER',
        message: '이 이메일은 애플 로그인으로 가입되어 있어요.',
        fieldErrors: null,
        details: { providers: ['APPLE'] },
      }),
    );
    expect(err.serverMessage).toBe('이 이메일은 애플 로그인으로 가입되어 있어요.');
    expect(err.details).toEqual({ providers: ['APPLE'] });
  });

  it('leaves details undefined when it is missing, null, or not an object', () => {
    expect(new ApiError(409, 'GET', '/x', JSON.stringify({ code: 'X' })).details).toBeUndefined();
    expect(
      new ApiError(409, 'GET', '/x', JSON.stringify({ code: 'X', details: null })).details,
    ).toBeUndefined();
    expect(
      new ApiError(409, 'GET', '/x', JSON.stringify({ code: 'X', details: [1] })).details,
    ).toBeUndefined();
    expect(
      new ApiError(409, 'GET', '/x', JSON.stringify({ code: 'X', message: 7 })).serverMessage,
    ).toBeUndefined();
  });
});
