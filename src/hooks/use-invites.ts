import { useCallback, useState } from 'react';

import { ApiError, ErrorCode, fetchMyInvite, redeemInvite } from '@/api';
import { track } from '@/lib/analytics';
import type { MyInviteCodeResponse } from '@/api/types';
import { useToast } from '@/components/ui/toast';

/** 초대코드 사용 결과 — 화면이 성공 연출(코인 +N)에 쓴다. */
export type RedeemResult = { rewardCoin: number };

/**
 * 친구 초대 리워드 (#518) — 내 코드·보상 현황 로드와 받은 코드 사용.
 * 화면 진입 시 load()를 부른다(코드가 없으면 서버가 이 시점에 발급).
 */
export function useInvites() {
  const [info, setInfo] = useState<MyInviteCodeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { show: toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setInfo(await fetchMyInvite());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 받은 코드 사용 — 성공 시 보상 코인을 돌려주고, 실패는 토스트 후 null. */
  const redeem = useCallback(
    async (code: string): Promise<RedeemResult | null> => {
      try {
        const res = await redeemInvite(code.trim());
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
    [toast],
  );

  return { info, loading, loadError, load, redeem };
}
