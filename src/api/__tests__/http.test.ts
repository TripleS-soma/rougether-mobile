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
});
