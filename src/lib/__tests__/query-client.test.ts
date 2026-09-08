import { QueryClient } from '@tanstack/react-query';

import { clearSession } from '@/api/auth';
import { bindSessionCacheReset } from '@/lib/query-client';

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
