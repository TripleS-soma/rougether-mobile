/**
 * AI 조정 추천 (#1006) — 활성 목록을 받고 수락·무시를 실행한다.
 *
 * **react-query 첫 사용처다 (#1027 1단계).** 종전에는 `useState` + `useEffect`로
 * 직접 받고 목록을 손으로 걷어냈다. 옮긴 뒤 달라진 것:
 *   - 캐시·로딩 상태가 `useQuery` 몫이 되어 상태 변수 4개 → 0개
 *   - 실패 수렴(`handleStale`)이 재조회 호출 대신 **무효화**로 끝난다
 *   - 백그라운드에서 돌아오면 stale한 목록을 자동으로 다시 받는다
 *
 * 서버가 유효한 것만 내려주므로(만료·루틴 삭제·선행 수정 건은 제외) 앱은
 * 필터링하지 않는다. 목록이 비면 진입점 자체를 감춘다.
 *
 * 반환 계약은 종전과 같다 — 호출부(`use-my-room-pages`)를 건드리지 않는다.
 */
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useLatestRef } from '@/hooks/use-stable-value';

import {
  acceptRecommendation,
  dismissRecommendation,
  fetchRecommendations,
  type RecommendationItem,
} from '@/api';
import { useToast } from '@/components/ui/toast';

/** 추천 목록 쿼리 키 — 무효화 지점이 늘어날 때 여기서만 고친다. */
export const RECOMMENDATIONS_KEY = ['recommendations'] as const;

/**
 * 빈 목록 기본값 — 인라인 `[]`는 매 렌더 새 배열이라 소비자의 memo가 깨진다
 * (`app-shell`의 `NO_CHARACTER_FRAMES`와 같은 이유).
 */
const NO_ITEMS: RecommendationItem[] = [];

export type UseRecommendationsOptions = {
  /**
   * 수락 성공 직후 — 루틴 데이터를 다시 받아야 한다. 수락은 스케줄 변경이라
   * 서버에서 **버전이 분기해 루틴 id가 바뀌므로**, 응답을 부분 반영하면
   * 완료 기록(`completions`)이 옛 id에 남아 오늘 표시가 사라져 보인다.
   *
   * 루틴이 react-query로 옮겨오면(#1028) 이 콜백은 `invalidateQueries`로
   * 대체된다 — 그때까지는 호출부가 자기 재조회를 넘긴다.
   */
  onAccepted?: () => void;
  /** 로그인 전에는 부르지 않는다. */
  enabled?: boolean;
};

export function useRecommendations({ onAccepted, enabled = true }: UseRecommendationsOptions = {}) {
  const qc = useQueryClient();
  const { show: toast } = useToast();

  const { data, isPending } = useQuery({
    queryKey: RECOMMENDATIONS_KEY,
    queryFn: fetchRecommendations,
    enabled,
    // 추천은 부가 정보다 — 실패하면 조용히 빈 목록으로 접는다(종전과 같은 결).
    // throwOnError 기본값이 false라 에러는 상태로만 남고, 아래에서 []로 읽는다.
  });

  const reload = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: RECOMMENDATIONS_KEY });
  }, [qc]);

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

  /** 처리한 카드를 캐시에서 즉시 걷는다 — 같은 제안이 다시 눌리지 않게. */
  const dropFromCache = useCallback(
    (recommendationId: number) => {
      qc.setQueryData<RecommendationItem[]>(RECOMMENDATIONS_KEY, (prev) =>
        (prev ?? []).filter((r) => r.recommendationId !== recommendationId),
      );
    },
    [qc],
  );

  const acceptMutation = useMutation({
    mutationFn: acceptRecommendation,
    onSuccess: (_res, recommendationId) => {
      dropFromCache(recommendationId);
      toast('루틴에 적용했어요', 'success');
      onAccepted?.();
    },
    onError: handleStale,
  });

  const dismissMutation = useMutation({
    mutationFn: dismissRecommendation,
    onSuccess: (_res, recommendationId) => dropFromCache(recommendationId),
    onError: handleStale,
  });

  /**
   * 처리 중인 추천 id — 버튼 중복 탭을 막는다. 뮤테이션이 둘로 갈렸지만
   * 화면에는 "지금 처리 중인 카드 하나"만 있으면 되므로 합쳐서 노출한다.
   */
  const pendingId: number | null =
    (acceptMutation.isPending ? acceptMutation.variables : null) ??
    (dismissMutation.isPending ? dismissMutation.variables : null) ??
    null;

  /**
   * 참조 안정성 (#539) — `useMutation`이 돌려주는 **객체는 매 렌더 새것**이라
   * 의존성에 넣으면 `accept`/`dismiss`가 매번 바뀌고, 나의 방 화면의 memo
   * 경계가 뚫린다(`app-shell-render-stability` 테스트가 이걸 잡는다).
   * `mutateAsync`는 참조가 고정이므로 그것만 꺼내 쓰고, 중복 탭 가드는
   * 최신값 ref로 읽는다.
   */
  const acceptAsync = acceptMutation.mutateAsync;
  const dismissAsync = dismissMutation.mutateAsync;
  const busyRef = useLatestRef(acceptMutation.isPending || dismissMutation.isPending);

  const accept = useCallback(
    async (recommendationId: number) => {
      if (busyRef.current) return false;
      try {
        await acceptAsync(recommendationId);
        return true;
      } catch {
        // onError가 이미 안내·무효화를 끝냈다 — 여기서는 실패만 알린다.
        return false;
      }
    },
    [acceptAsync, busyRef],
  );

  const dismiss = useCallback(
    async (recommendationId: number) => {
      if (busyRef.current) return;
      try {
        await dismissAsync(recommendationId);
      } catch {
        // onError가 처리한다.
      }
    },
    [busyRef, dismissAsync],
  );

  const items = data ?? NO_ITEMS;

  return useMemo(
    () => ({ items, loading: isPending, pendingId, accept, dismiss, reload }),
    [items, isPending, pendingId, accept, dismiss, reload],
  );
}
