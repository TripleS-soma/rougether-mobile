/**
 * 집 탐색 — 둘러볼 수 있는 집 목록(페이지네이션 #975)과 그 목록에서 하는
 * 행동(입주 신청·참여 전 미리보기). useHouses가 합성해 같은 키로 돌려준다.
 *
 * 내 집 목록과는 서버 excludeJoined 필터(#578)로만 엮인다 — 입주 신청은
 * 방장 승인 대기라 내 집 번들을 건드리지 않고 탐색 목록만 다시 받는다.
 *
 * 콜백은 전부 useCallback, 반환 객체는 useMemo — memo 경계(#539) 보존.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, ErrorCode, fetchHousePreviewDetail, fetchHouses, requestHouseJoin } from '@/api';
import { toHousePreviewDetail, toSearchHouse, type ShopCatalogue } from '@/api/adapters';
import type { HousePreviewDetail, SearchHouse } from '@/components/screens/house-search-screen';
import { useToast } from '@/components/ui/toast';
import { track } from '@/lib/analytics';

/** 집 탐색 한 페이지 크기 (#975). */
const SEARCH_PAGE_SIZE = 30;

/**
 * 다음 페이지가 남았는지. `totalElements`가 정본이고, 서버가 그걸 안 주는
 * 경우에만 "받은 개수가 페이지를 꽉 채웠나"로 추정한다.
 */
function hasNextPage(res: { items?: unknown[]; totalElements?: number }, loaded: number) {
  if (typeof res.totalElements === 'number') return loaded < res.totalElements;
  return (res.items?.length ?? 0) >= SEARCH_PAGE_SIZE;
}

export function useHouseSearch() {
  const [searchHouses, setSearchHouses] = useState<SearchHouse[]>([]);
  /** 다음 페이지가 남았는지 (#975) — 목록 끝에서 이어 붙일지 판단. */
  const [searchHasNext, setSearchHasNext] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  /** 마지막으로 받은 페이지 번호. 무한 스크롤이 여기서 이어간다. */
  const searchPageRef = useRef(0);
  const [searchLoading, setSearchLoading] = useState(true);
  // 초기 로드 실패 플래그 (#549) — 빈 검색 결과로 위장하지 않도록 화면이
  // 에러+다시 시도를 보여준다. 재시도 성공 시 해제.
  const [searchError, setSearchError] = useState(false);
  const { show: toast } = useToast();

  const reloadSearch = useCallback(async () => {
    // excludeJoined — 본인 ACTIVE(소유 포함) 집은 서버가 걸러 준다 (#578).
    const list = await fetchHouses(0, SEARCH_PAGE_SIZE, true);
    const items = (list.items ?? []).map((h, i) => toSearchHouse(h, i));
    searchPageRef.current = 0;
    setSearchHouses(items);
    setSearchHasNext(hasNextPage(list, items.length));
  }, []);

  /**
   * 다음 페이지를 이어 붙인다 (#975) — 종전엔 30개에서 조용히 잘렸다.
   *
   * `toSearchHouse`의 index가 아이콘·배경색을 돌리므로 **이미 쌓인 개수만큼
   * 밀어서** 넘긴다. 0부터 다시 세면 페이지 경계에서 같은 아이콘이 붙는다.
   */
  const loadMoreSearch = useCallback(async () => {
    if (searchLoadingMore || !searchHasNext) return;
    setSearchLoadingMore(true);
    try {
      const next = searchPageRef.current + 1;
      const list = await fetchHouses(next, SEARCH_PAGE_SIZE, true);
      searchPageRef.current = next;
      setSearchHouses((prev) => {
        // 같은 집이 두 번 오면(생성/삭제로 페이지가 밀릴 때) 중복 키가 된다.
        // seen을 돌면서 갱신해 **한 페이지 안의 중복**까지 같이 막는다.
        const seen = new Set(prev.map((h) => h.id));
        const added: SearchHouse[] = [];
        for (const h of list.items ?? []) {
          // index는 최종 목록에서의 자리 — 아이콘·배경이 여기서 갈린다.
          const mapped = toSearchHouse(h, prev.length + added.length);
          if (seen.has(mapped.id)) continue;
          seen.add(mapped.id);
          added.push(mapped);
        }
        const merged = [...prev, ...added];
        setSearchHasNext(hasNextPage(list, merged.length));
        return merged;
      });
    } catch {
      // 이 훅의 다른 액션과 같은 처리 — 조용히 멈추면 스피너만 사라져
      // "왜 안 나오지?"가 된다. hasNext는 그대로라 다시 스크롤하면 재시도된다.
      toast('집 목록을 더 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
    } finally {
      setSearchLoadingMore(false);
    }
  }, [searchHasNext, searchLoadingMore, toast]);

  /** 탐색 목록 로드 사이클 — 실패는 빈 검색 결과와 구분해 표시한다 (#549). */
  const loadSearch = useCallback(async () => {
    setSearchLoading(true);
    setSearchError(false);
    try {
      await reloadSearch();
    } catch {
      setSearchError(true);
    } finally {
      setSearchLoading(false);
    }
  }, [reloadSearch]);

  useEffect(() => {
    void loadSearch();
  }, [loadSearch]);

  /** Request admission to a browsable house; true when the request is pending. */
  const joinHouse = useCallback(
    async (houseId: number): Promise<boolean> => {
      try {
        await requestHouseJoin(houseId);
        track('house_join_request', { via: 'browse' });
        toast('입주 신청을 보냈어요!', 'success');
        await reloadSearch();
        return true;
      } catch (error) {
        // 앱은 정원 수로 미리 막지 않는다 (#948) — 봇이 비켜줄 수 있어서
        // 서버만이 "사람이 들어갈 수 있는지"를 안다. 그래서 만석은 추측이
        // 아니라 서버가 준 코드로 말한다.
        const code = error instanceof ApiError ? error.code : undefined;
        toast(
          code === ErrorCode.HOUSE_JOIN_REQUEST_ALREADY_PENDING
            ? '이미 입주 신청 중이에요'
            : code === ErrorCode.HOUSE_FULL
              ? '정원이 가득 찼어요'
              : '입주 신청에 실패했어요. 잠시 후 다시 시도해주세요.',
          'error',
        );
        return false;
      }
    },
    [toast, reloadSearch],
  );

  // 탐색 카드 → 참여 전 미리보기 (#328). null이면 호출측은 모달을 열지 않는다.
  // 카탈로그를 주면 memberRooms를 실제 방 렌더 모델로 변환한다 (#386).
  const previewHouse = useCallback(
    async (houseId: number, catalogue?: ShopCatalogue): Promise<HousePreviewDetail | null> => {
      try {
        const detail = toHousePreviewDetail(await fetchHousePreviewDetail(houseId), catalogue);
        // 소셜 퍼널 (#803) — 탐색에서 카드를 눌러 안을 들여다본 지점.
        track('house_preview');
        return detail;
      } catch {
        toast('집 정보를 불러오지 못했어요', 'error');
        return null;
      }
    },
    [toast],
  );

  return useMemo(
    () => ({
      // 참여 중인 집은 서버 excludeJoined 필터가 이미 걸렀다 (#578).
      searchHouses,
      searchHasNext,
      searchLoadingMore,
      loadMoreSearch,
      searchLoading,
      searchError,
      /** Re-run the failed initial load (에러 상태의 다시 시도, #549). */
      retrySearch: loadSearch,
      joinHouse,
      previewHouse,
    }),
    [
      searchHouses,
      searchHasNext,
      searchLoadingMore,
      loadMoreSearch,
      searchLoading,
      searchError,
      loadSearch,
      joinHouse,
      previewHouse,
    ],
  );
}
