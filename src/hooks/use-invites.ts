import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, ErrorCode, fetchMyInvite, redeemInvite } from '@/api';
import { getSessionUserId } from '@/api/auth';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';
import { useToast } from '@/components/ui/toast';

/** 초대코드 사용 결과 — 화면이 성공 연출(코인 +N)에 쓴다. */
export type RedeemResult = { rewardCoin: number };

/**
 * 친구 초대 리워드 (#518) — 내 코드·보상 현황 로드와 받은 코드 사용.
 * 화면 진입 시 load()를 부른다(코드가 없으면 서버가 이 시점에 발급).
 *
 * react-query로 이관 (#1027). 쿼리는 **지연(enabled: false)** 이다 — 이 훅은
 * 셸에 상주하는 설정 표면에서 불리는데, 마운트 즉시 받으면 앱 부팅마다
 * `GET /invites/me`가 나가고 그 호출이 코드 발급이라는 부수효과를 가진다.
 * 종전처럼 화면 진입의 `load()`가 첫 요청이다.
 *
 * 반환 계약은 종전과 같다 — 호출부(`use-settings-surface`)를 건드리지 않는다.
 */
export function useInvites() {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  // 키는 userId로 메모 — 매 렌더 새 배열이면 load의 참조가 흔들린다 (#539).
  const userId = getSessionUserId();
  const queryKey = useMemo(() => queryKeys.invites(userId), [userId]);

  const { data, isError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: fetchMyInvite,
    enabled: false,
  });

  const load = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const { mutateAsync } = useMutation({
    mutationFn: (code: string) => redeemInvite(code.trim()),
    // 보상 카운트가 바뀔 수 있다 — 다음 load()가 새로 받게 stale로 표시.
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  /** 받은 코드 사용 — 성공 시 보상 코인을 돌려주고, 실패는 토스트 후 null. */
  const redeem = useCallback(
    async (code: string): Promise<RedeemResult | null> => {
      try {
        const res = await mutateAsync(code);
        // 확산의 반대편 (#803) — 초대를 받고 실제로 쓴 사람.
        track('invite_redeem');
        return { rewardCoin: res.rewardCoin ?? 0 };
      } catch (e) {
        if (e instanceof ApiError && e.code === ErrorCode.INVITE_ALREADY_REDEEMED) {
          toast('초대코드는 한 번만 사용할 수 있어요', 'error');
        } else if (e instanceof ApiError && e.code === ErrorCode.INVITE_SELF_NOT_ALLOWED) {
          toast('내 초대코드는 사용할 수 없어요', 'error');
        } else if (e instanceof ApiError && e.status === 404) {
          toast('초대코드를 찾을 수 없어요', 'error');
        } else {
          toast('초대코드 사용에 실패했어요', 'error');
        }
        return null;
      }
    },
    [mutateAsync, toast],
  );

  const info = data ?? null;
  // 지연 쿼리라 isPending은 첫 load() 전에도 true다 — 로딩은 실제 요청 중으로만.
  const loading = isFetching;
  const loadError = isError && !isFetching;

  return useMemo(
    () => ({ info, loading, loadError, load, redeem }),
    [info, loading, loadError, load, redeem],
  );
}
