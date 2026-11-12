import { deleteMe } from '@/api/me';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

it('선택한 사유를 DELETE /me JSON 본문에 담는다', async () => {
  const fetchMock = jest.fn(async () => ({ ok: true, status: 204, text: async () => '' }));
  global.fetch = fetchMock as unknown as typeof fetch;
  await deleteMe('MISSING_FEATURE');
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/me'),
    expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ reason: 'MISSING_FEATURE' }),
    }),
  );
});

it('사유를 고르지 않으면 기존처럼 본문 없이 탈퇴한다', async () => {
  const fetchMock = jest.fn(async () => ({ ok: true, status: 204, text: async () => '' }));
  global.fetch = fetchMock as unknown as typeof fetch;
  await deleteMe();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/me'),
    expect.objectContaining({
      method: 'DELETE',
      body: undefined,
    }),
  );
});
