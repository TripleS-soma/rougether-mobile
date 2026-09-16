import * as Sentry from '@sentry/react-native';
import { QueryClient } from '@tanstack/react-query';

import { clearSession } from '@/api/auth';
import { ApiError } from '@/api/http';
import {
  bindSessionCacheReset,
  createQueryClient,
  shouldReportQueryError,
} from '@/lib/query-client';

// 세션이 지워지면 react-query 캐시도 비운다 — 계정 전환 시 이전 사용자의 추천·뽑기가 남지 않게.
describe('bindSessionCacheReset', () => {
  it('clearSession 뒤 캐시가 비고, 구독을 풀면 더는 반응하지 않는다', async () => {
    const client = new QueryClient();
    client.setQueryData(['recommendations'], [{ id: 1 }]);
    const unbind = bindSessionCacheReset(client);

    await clearSession();
    expect(client.getQueryData(['recommendations'])).toBeUndefined();

    unbind();
    client.setQueryData(['recommendations'], [{ id: 2 }]);
    await clearSession();
    expect(client.getQueryData(['recommendations'])).toEqual([{ id: 2 }]);
  });
});

describe('조회·변경 실패 보고 (#1376)', () => {
  const captureException = Sentry.captureException as unknown as jest.Mock;

  it('4xx·오프라인은 보내지 않고, 5xx·예상치 못한 예외만 보낸다', () => {
    expect(
      shouldReportQueryError(
        new ApiError(404, 'GET', '/invites/by-code/{id}', '{"code":"INVITE_NOT_FOUND"}'),
      ),
    ).toBe(false);
    expect(shouldReportQueryError(new ApiError(503, 'GET', '/routines'))).toBe(true);
    expect(shouldReportQueryError(new TypeError('Network request failed'))).toBe(false);
    expect(shouldReportQueryError(new TypeError('Failed to fetch'))).toBe(false);
    expect(
      shouldReportQueryError(
        new TypeError("Cannot read properties of undefined (reading 'items')"),
      ),
    ).toBe(true);
  });

  it('최종 실패한 조회를 키의 첫 요소만 붙여 한 번 보고한다', async () => {
    captureException.mockClear();
    const client = createQueryClient();
    await client
      .fetchQuery({
        queryKey: ['routines', 4, '2026-09-16'],
        queryFn: () => Promise.reject(new Error('parse failed')),
        retry: false,
      })
      .catch(() => {});
    expect(captureException).toHaveBeenCalledTimes(1);
    const [, hint] = captureException.mock.calls[0];
    expect(hint.extra).toEqual({ source: 'query', key: 'routines' });
  });

  it('4xx 조회 실패는 보고하지 않는다', async () => {
    captureException.mockClear();
    const client = createQueryClient();
    await client
      .fetchQuery({
        queryKey: ['invites', 'ABCD'],
        queryFn: () => Promise.reject(new ApiError(404, 'GET', '/invites/by-code/{id}')),
        retry: false,
      })
      .catch(() => {});
    expect(captureException).not.toHaveBeenCalled();
  });
});
