/**
 * 내 지갑(코인·다이아) — react-query 캐시 (장부 16번, use-my-room-data 조각).
 *
 * 스스로 받지 않는다(`enabled: false`): 첫 잔액은 나의 방 부트 묶음(`fetchMyRoomBootData`)이
 * `seedWallet`으로 넣고, 그 뒤엔 행동 결과로 직접 고치거나(`setWallet` — 완료 보상·뽑기·상점·
 * 출석) `refreshWallet`으로 다시 받는다. 포커스 재조회에 맡기지 않는 건 예전과 같다.
 *
 * 돌려주는 함수는 전부 참조가 고정이다(#539 memo 경계). 세션 사용자는 **호출 시점에** 읽는다 —
 * 렌더 시점 값을 의존성에 두면 세션 id가 바뀔 때 함수가 새로 생기고, 그걸 의존하는 나의 방 부트
 * 로드(`reload` → 초기 로드 effect)가 한 번 더 돈다(#1515 리뷰).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Dispatch, type SetStateAction, useCallback } from 'react';

import { fetchWallets, getSessionUserId } from '@/api';
import { toWallet } from '@/api/adapters';
import { DEFAULT_WALLET, type Wallet } from '@/constants/currency';
import { queryKeys } from '@/lib/query-keys';

const fetchWallet = async (): Promise<Wallet> => toWallet(await fetchWallets());

export function useWallet() {
  const userId = getSessionUserId();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: queryKeys.wallet(userId),
    queryFn: fetchWallet,
    enabled: false,
  });

  /** `useState`의 setter와 같은 모양 — 받기 전이면 기본 지갑(0·0) 위에 쌓는다. */
  const setWallet: Dispatch<SetStateAction<Wallet>> = useCallback(
    (next) =>
      queryClient.setQueryData<Wallet>(queryKeys.wallet(getSessionUserId()), (prev) =>
        typeof next === 'function' ? next(prev ?? DEFAULT_WALLET) : next,
      ),
    [queryClient],
  );

  /** 지갑만 다시 받는다 — staleTime 0: 보상 직후엔 30초 캐시가 아니라 서버 값. 실패는 조용히(마지막 잔액 유지). */
  const refreshWallet = useCallback(async () => {
    await queryClient
      .fetchQuery({
        queryKey: queryKeys.wallet(getSessionUserId()),
        queryFn: fetchWallet,
        staleTime: 0,
      })
      .catch(() => undefined);
  }, [queryClient]);

  return {
    wallet: data ?? DEFAULT_WALLET,
    setWallet,
    refreshWallet,
  };
}
