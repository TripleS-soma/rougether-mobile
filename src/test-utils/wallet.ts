import type { QueryClient } from '@tanstack/react-query';

import { getSessionUserId } from '@/api';
import type { Wallet } from '@/constants/currency';
import { queryKeys } from '@/lib/query-keys';

/** 지갑 캐시(`useWallet`)에 들어간 값 — 훅이 지갑을 직접 고쳤는지 테스트에서 읽는다. */
export function walletInCache(client: QueryClient): Wallet | undefined {
  return client.getQueryData<Wallet>(queryKeys.wallet(getSessionUserId()));
}
