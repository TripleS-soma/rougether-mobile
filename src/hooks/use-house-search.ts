/**
 * 집 탐색 — 둘러볼 수 있는 집 목록(페이지네이션 #975)과 그 목록에서 하는
 * 행동(입주 신청·참여 전 미리보기). useHouses가 합성해 같은 키로 돌려준다.
 *
 * 내 집 목록과는 서버 excludeJoined 필터(#578)로만 엮인다 — 입주 신청은
 * 방장 승인 대기라 내 집 번들을 건드리지 않고 탐색 목록만 다시 받는다.
 *
 * 서버 상태는 react-query (#1027, 리팩토링 장부 16번) — 받은 페이지를 그대로 캐시하고
 * 화면 목록은 `mergeSearchPages`로 계산한다. 호출 계약은 명령형 그대로라 쿼리는 스스로
 * 받지 않고(enabled:false) `ensureSearch`·다시 시도·입주 신청이 첫 페이지부터 다시 받는다.
 *
 * 콜백은 전부 useCallback, 반환 객체는 useMemo — memo 경계(#539) 보존.
 */
import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  ApiError,
  ErrorCode,
  fetchHousePreviewDetail,
  fetchHouses,
  getSessionUserId,
  type Page,
  requestHouseJoin,
} from '@/api';
import { toHousePreviewDetail, toSearchHouse, type ShopCatalogue } from '@/api/adapters';
import type { HousePreviewDetail, SearchHouse } from '@/components/screens/house-search-screen';
import { useToast } from '@/components/ui/toast';
import { i18n } from '@/i18n';
import type { HouseSummary } from '@/api/types';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';

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

type SearchPages = InfiniteData<Page<HouseSummary>, number>;

function searchOptions(userId: number | null | undefined) {
  return {
    queryKey: queryKeys.houseSearch(userId),
    // excludeJoined — 본인 ACTIVE(소유 포함) 집은 서버가 걸러 준다 (#578).
    queryFn: ({ pageParam }: { pageParam: number }) =>
      fetchHouses(pageParam, SEARCH_PAGE_SIZE, true),
    initialPageParam: 0,
    getNextPageParam: (_last: Page<HouseSummary>, _all: unknown, lastPage: number) => lastPage + 1,
  };
}

const NO_SEARCH = { houses: [] as SearchHouse[], hasNext: false };

/**
 * 받은 페이지들 → 탐색 목록 (#975).
 *
 * `toSearchHouse`의 index가 아이콘·배경색을 돌리므로 **이미 쌓인 개수만큼 밀어서**
 * 넘긴다. 0부터 다시 세면 페이지 경계에서 같은 아이콘이 붙는다. 같은 집이 두 번 오면
 * (생성/삭제로 페이지가 밀릴 때, 한 페이지 안에서도) 중복 키가 되므로 건너뛴다.
 */
export function mergeSearchPages(pages: Page<HouseSummary>[]) {
  const seen = new Set<SearchHouse['id']>();
  const houses: SearchHouse[] = [];
  let hasNext = false;
  for (const page of pages) {
    for (const h of page.items) {
      // index는 최종 목록에서의 자리 — 아이콘·배경이 여기서 갈린다.
      const mapped = toSearchHouse(h, houses.length);
      if (seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      houses.push(mapped);
    }
    hasNext = hasNextPage(page, houses.length);
  }
  return { houses, hasNext };
}

export function useHouseSearch() {
  const userId = getSessionUserId();
  const queryClient = useQueryClient();
  const { data } = useInfiniteQuery({ ...searchOptions(userId), enabled: false });
  const { houses: searchHouses, hasNext: searchHasNext } = useMemo(
    () => (data ? mergeSearchPages(data.pages) : NO_SEARCH),
    [data],
  );
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(true);
  // 초기 로드 실패 플래그 (#549) — 빈 검색 결과로 위장하지 않도록 화면이
  // 에러+다시 시도를 보여준다. 재시도 성공 시 해제.
  const [searchError, setSearchError] = useState(false);
  const { show: toast } = useToast();

  /** 첫 페이지만 다시 받는다 — 이어 붙였던 페이지는 접는다. 실패는 던진다. */
  const reloadSearch = useCallback(async () => {
    await queryClient.fetchInfiniteQuery({ ...searchOptions(userId), pages: 1, staleTime: 0 });
  }, [queryClient, userId]);

  /**
   * 다음 페이지를 이어 붙인다 (#975) — 종전엔 30개에서 조용히 잘렸다. 캐시에 **함수형으로**
   * 붙인다(fetchNextPage는 시작 시점 페이지에 붙인 결과로 덮어쓴다).
   */
  const loadMoreSearch = useCallback(async () => {
    if (searchLoadingMore || !searchHasNext) return;
    setSearchLoadingMore(true);
    try {
      const key = queryKeys.houseSearch(userId);
      const next = (queryClient.getQueryData<SearchPages>(key)?.pageParams.at(-1) ?? -1) + 1;
      const page = await fetchHouses(next, SEARCH_PAGE_SIZE, true);
      queryClient.setQueryData<SearchPages>(
        key,
        (old) => old && { pages: [...old.pages, page], pageParams: [...old.pageParams, next] },
      );
    } catch {
      // 이 훅의 다른 액션과 같은 처리 — 조용히 멈추면 스피너만 사라져
      // "왜 안 나오지?"가 된다. hasNext는 그대로라 다시 스크롤하면 재시도된다.
      toast(i18n.t('house.search.loadMoreFailed'), 'error');
    } finally {
      setSearchLoadingMore(false);
    }
  }, [searchHasNext, searchLoadingMore, queryClient, userId, toast]);

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

  /**
   * 탐색 화면에 처음 들어갈 때 한 번 받는다 (성능 장부 N3) — 예전엔 집이 있는 사용자도
   * 앱 시작마다 30건을 받았다. 이후 갱신은 참여 신청·다시 시도가 한다.
   */
  const requested = useRef(false);
  const ensureSearch = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    void loadSearch();
  }, [loadSearch]);

  /** Request admission to a browsable house; true when the request is pending. */
  const joinHouse = useCallback(
    async (houseId: number): Promise<boolean> => {
      try {
        await requestHouseJoin(houseId);
        track('house_join_request', { via: 'browse' });
        toast(i18n.t('house.search.requestSent'), 'success');
        await reloadSearch();
        return true;
      } catch (error) {
        // 앱은 정원 수로 미리 막지 않는다 (#948) — 봇이 비켜줄 수 있어서
        // 서버만이 "사람이 들어갈 수 있는지"를 안다. 그래서 만석은 추측이
        // 아니라 서버가 준 코드로 말한다.
        const code = error instanceof ApiError ? error.code : undefined;
        toast(
          code === ErrorCode.HOUSE_JOIN_REQUEST_ALREADY_PENDING
            ? i18n.t('house.search.alreadyPending')
            : code === ErrorCode.HOUSE_FULL
              ? i18n.t('house.search.fullToast')
              : i18n.t('house.search.requestFailed'),
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
        toast(i18n.t('house.search.loadFailed'), 'error');
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
      ensureSearch,
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
      ensureSearch,
      joinHouse,
      previewHouse,
    ],
  );
}
