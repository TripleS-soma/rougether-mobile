/**
 * AI 조정 추천 (#1006) — 활성 목록을 마운트 때 한 번 받고, 수락·무시를 실행한다.
 *
 * 서버가 유효한 것만 내려주므로(만료·루틴 삭제·선행 수정 건은 제외) 앱은
 * 필터링하지 않는다. 목록이 비면 진입점 자체를 감춘다.
 *
 * 반환 객체는 useMemo, 액션은 useCallback — 나의 방 memo 경계(#539)를 뚫지
 * 않게 한다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  acceptRecommendation,
  dismissRecommendation,
  fetchRecommendations,
  type RecommendationItem,
} from '@/api';
import { useToast } from '@/components/ui/toast';

export type UseRecommendationsOptions = {
  /**
   * 수락 성공 직후 — 루틴 데이터를 다시 받아야 한다. 수락은 스케줄 변경이라
   * 서버에서 **버전이 분기해 루틴 id가 바뀌므로**, 응답을 부분 반영하면
   * 완료 기록(`completions`)이 옛 id에 남아 오늘 표시가 사라져 보인다.
   */
  onAccepted?: () => void;
  /** 로그인 전에는 부르지 않는다. */
  enabled?: boolean;
};

export function useRecommendations({ onAccepted, enabled = true }: UseRecommendationsOptions = {}) {
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);
  /** 처리 중인 추천 id — 버튼 중복 탭을 막는다. */
  const [pendingId, setPendingId] = useState<number | null>(null);
  const { show: toast } = useToast();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchRecommendations());
    } catch {
      // 추천은 부가 정보다 — 실패하면 조용히 빈 목록으로 접는다.
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      const list = await fetchRecommendations().catch(() => [] as RecommendationItem[]);
      if (active) setItems(list);
    })();
    return () => {
      active = false;
    };
  }, [enabled]);

  /**
   * 실패 수렴 지점 (#1006) — 404 NOT_FOUND와 409 4종(ALREADY_HANDLED·EXPIRED·
   * ROUTINE_DELETED·STALE)은 전부 "보고 있던 카드가 더는 유효하지 않다"는 같은
   * 뜻이다. 코드별로 갈라 봐야 사용자가 할 일은 같으므로 안내 한 줄 + 재조회로
   * 끝낸다.
   */
  const handleStale = useCallback(async () => {
    toast('제안이 더는 유효하지 않아요', 'error');
    await reload();
  }, [reload, toast]);

  const accept = useCallback(
    async (recommendationId: number) => {
      if (pendingId != null) return false;
      setPendingId(recommendationId);
      try {
        await acceptRecommendation(recommendationId);
        // 카드를 먼저 걷어 같은 제안이 다시 눌리지 않게 한다.
        setItems((prev) => prev.filter((r) => r.recommendationId !== recommendationId));
        toast('루틴에 적용했어요', 'success');
        onAccepted?.();
        return true;
      } catch {
        await handleStale();
        return false;
      } finally {
        setPendingId(null);
      }
    },
    [handleStale, onAccepted, pendingId, toast],
  );

  const dismiss = useCallback(
    async (recommendationId: number) => {
      if (pendingId != null) return;
      setPendingId(recommendationId);
      try {
        await dismissRecommendation(recommendationId);
        setItems((prev) => prev.filter((r) => r.recommendationId !== recommendationId));
      } catch {
        await handleStale();
      } finally {
        setPendingId(null);
      }
    },
    [handleStale, pendingId],
  );

  return useMemo(
    () => ({ items, loading, pendingId, accept, dismiss, reload }),
    [items, loading, pendingId, accept, dismiss, reload],
  );
}
