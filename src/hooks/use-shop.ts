/**
 * Shop catalogue + purchase + room placement, backed by the API. Three queries
 * — the catalogue (`GET /items`), the inventory (`GET /me/items`,
 * itemId↔userItemId) and the saved room (`GET /rooms/me`) — and everything the
 * screens read (`catalogue`·`ownedIds`·`placement`) is **derived** from their
 * caches. 배치하기 persists via `PUT /rooms/me/layout`. With no saved layout
 * yet, the room seeds from owned items client-side until the first save.
 *
 * react-query로 이관 (#1027). 종전에는 `load()`가 세 요청을 한 번에 받아 상태
 * 4개에 나눠 담고, 구매·청소·저장이 각각 그 상태를 손으로 고쳤다. 이제
 * 뮤테이션은 **캐시에 쓰고**(구매 → 인벤토리에 한 줄, 청소 → 거미줄 제거, 저장
 * → 배치·리비전) 파생값이 따라온다. 뽑기 후 재조회는 `useGacha`가 인벤토리
 * 키를 무효화하므로 셸이 `refreshOwned`를 손으로 부를 일이 없다 — 남은 호출자는
 * AI 가구 스튜디오(`onGoToRoom`)뿐이고, 그쪽은 성공 여부를 되돌려 받아야 한다.
 *
 * 반환 계약은 종전과 같다 — 호출부(`app-shell`)를 건드리지 않는다.
 */
import { type Dispatch, type SetStateAction, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ApiError,
  ErrorCode,
  fetchItems,
  fetchMyItems,
  cleanMyCobweb,
  fetchMyRoom,
  getSessionUserId,
  purchaseItem,
  updateRoomLayout,
} from '@/api';
import {
  fromRoomPlacements,
  fromRoomSlots,
  ownedPlacement,
  toLayoutPlacements,
  toShopCatalogue,
  toUserItemMap,
} from '@/api/adapters';
import type { RoomWithLayout } from '@/api/rooms';
import type { ItemResponse, MyItemSummary } from '@/api/types';
import { useToast } from '@/components/ui/toast';
import { type Wallet } from '@/constants/currency';
import { useLatestRef } from '@/hooks/use-stable-value';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/query-keys';
import type { RoomCobweb } from '@/components/room/room';
import type { PlacedFurniture } from '@/resources/furniture';

// 빈 기본값 — 인라인 `[]`는 매 렌더 새 배열이라 파생 memo가 매번 다시 돈다.
const NO_ITEMS: ItemResponse[] = [];
const NO_MY_ITEMS: MyItemSummary[] = [];

export type RoomPlacement = {
  /** 자유 배치 항목 (#327) — 가구의 유일한 정본 (#925). */
  items: PlacedFurniture[];
  wallpaperId: string;
  floorId: string | null;
  backgroundId: string | null;
  /** 낙관적 잠금 리비전 — 저장 시 baseRevision으로 그대로 보낸다. */
  layoutRevision: number;
  /** 내 방에 낀 거미줄 (#829) — 없으면 null. */
  cobweb: RoomCobweb | null;
};

export function useShop(setWallet: Dispatch<SetStateAction<Wallet>>) {
  const qc = useQueryClient();
  const { show: toast } = useToast();
  // 키는 userId로 메모 — 매 렌더 새 배열이면 콜백 참조가 흔들린다 (#539).
  const userId = getSessionUserId();
  const myItemsKey = useMemo(() => queryKeys.myItems.byUser(userId), [userId]);
  const myRoomKey = useMemo(() => queryKeys.myRoom.byUser(userId), [userId]);

  const itemsQuery = useQuery({ queryKey: queryKeys.items, queryFn: fetchItems });
  // 인벤토리·방은 실패해도 화면이 죽지 않는다(종전 `.catch(() => [])`와 같은 결) —
  // 데이터 없음으로 읽어 소유분·기본 표면으로 접는다. 에러로 드러나는 건 카탈로그뿐.
  const myItemsQuery = useQuery({ queryKey: myItemsKey, queryFn: fetchMyItems });
  const roomQuery = useQuery({ queryKey: myRoomKey, queryFn: fetchMyRoom });
  const { refetch: refetchItems } = itemsQuery;
  const { refetch: refetchMyItems } = myItemsQuery;
  const { refetch: refetchRoom } = roomQuery;

  const items = itemsQuery.data ?? NO_ITEMS;
  const myItems = myItemsQuery.data ?? NO_MY_ITEMS;
  const room = roomQuery.data;

  const catalogue = useMemo(() => toShopCatalogue(items, myItems), [items, myItems]);
  // itemId(string) → userItemId, needed to save placements.
  const userItemMap = useMemo(() => toUserItemMap(myItems), [myItems]);
  const ownedIds = catalogue.ownedIds;

  const placement = useMemo<RoomPlacement>(() => {
    // 표면(벽지·바닥·배경)은 여전히 슬롯에 산다 — 서버가 room_surface_slots에
    // 저장하고 `slots`로 돌려준다 (서버 #162). 저장 전이면 소유분에서 고른다.
    const saved = room?.slots?.length ? fromRoomSlots(room.slots, catalogue, userItemMap) : null;
    const fallback = ownedPlacement(catalogue);
    // 가구는 전부 자유배치다 (#925) — 슬롯 앵커 프리필을 없앴다. 서버가
    // placements를 정본으로 주고, 아직 SLOT_V1인 방은 가구가 비어 있다
    // (스토어 빌드는 슬롯에 쓴 적이 없다 — v1.0.0이 슬롯 쓰기 제거 이후).
    return {
      items: fromRoomPlacements(room?.placements ?? [], catalogue, userItemMap),
      wallpaperId: saved?.wallpaperId ?? fallback.wallpaperId,
      floorId: saved ? saved.floorId : fallback.floorId,
      backgroundId: saved ? saved.backgroundId : fallback.backgroundId,
      layoutRevision: room?.layoutRevision ?? 0,
      // 서버가 안 주면 깨끗한 방 (#829).
      cobweb: room?.cobweb ?? null,
    };
  }, [room, catalogue, userItemMap]);

  const loading =
    itemsQuery.isPending ||
    myItemsQuery.isPending ||
    roomQuery.isPending ||
    // 실패 후 재시도 중에도 스피너 — 종전 `load()`가 loading을 켰던 것과 같게.
    (itemsQuery.isFetching && itemsQuery.data === undefined);
  const error = itemsQuery.isError && !itemsQuery.isFetching;

  const retry = useCallback(async () => {
    await Promise.all([refetchItems(), refetchMyItems(), refetchRoom()]);
  }, [refetchItems, refetchMyItems, refetchRoom]);

  /** 거미줄을 캐시에서 걷는다 — 성공·이미 치워짐(409) 둘 다 결과는 같다. */
  const clearCobweb = useCallback(() => {
    qc.setQueryData<RoomWithLayout>(myRoomKey, (prev) =>
      prev ? { ...prev, cobweb: undefined } : prev,
    );
  }, [qc, myRoomKey]);

  const { mutateAsync: cleanAsync } = useMutation({ mutationFn: cleanMyCobweb });

  /**
   * 내 방 거미줄 청소 (#830, 서버 #277) — 성공하면 받은 코인 수를 돌려준다.
   * 화면이 그 값으로 코인 연출을 쏘므로, 실패·중복은 null이어야 한다.
   *
   * 409(ROOM_COBWEB_NOT_ACTIVE)는 실패가 아니다 — 같은 집 구성원이 먼저
   * 치운 것이라, 에러 문구 대신 거미줄만 걷고 그 사실을 알려준다. 보상은
   * 최초 1인에게만 가므로 코인 연출은 쏘지 않는다.
   *
   * 참조 안정 필수 (#539) — MyRoomScreen memo 경계를 넘는 prop이라, 매
   * 렌더 새 함수면 방 캔버스 서브트리가 통째로 다시 그려진다. `mutateAsync`는
   * 참조가 고정이므로 그것만 꺼내 쓴다.
   */
  const cleanCobweb = useCallback(async (): Promise<number | null> => {
    try {
      const res = await cleanAsync();
      clearCobweb();
      if (res.rewardCurrencyType === 'COIN' && res.balance != null) {
        setWallet((prev) => ({ ...prev, coin: res.balance as number }));
      }
      return res.rewardAmount ?? 0;
    } catch (err) {
      if (err instanceof ApiError && err.code === ErrorCode.ROOM_COBWEB_NOT_ACTIVE) {
        clearCobweb();
        toast('누가 먼저 치워줬어요');
        return null;
      }
      toast('거미줄을 치우지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
      return null;
    }
  }, [cleanAsync, clearCobweb, setWallet, toast]);

  const { mutateAsync: purchaseAsync } = useMutation({
    mutationFn: (itemId: number) => purchaseItem(itemId),
  });

  /** Buy an item with diamond. Returns true on success (false on insufficient funds). */
  const purchase = useCallback(
    async (itemId: string): Promise<boolean> => {
      try {
        const res = await purchaseAsync(Number(itemId));
        const w = res.wallet;
        if (w?.currencyType && w.balance != null) {
          // Purchase returns only the spent currency — merge, don't replace.
          setWallet((prev) => ({
            ...prev,
            [w.currencyType === 'COIN' ? 'coin' : 'diamond']: w.balance as number,
          }));
        }
        // 인벤토리 캐시에 바로 한 줄 — 보유중 표시와 배치 저장(userItemId)이
        // 재조회 없이 따라온다. 카탈로그의 owned 플래그는 인벤토리 병합이 덮는다.
        qc.setQueryData<MyItemSummary[]>(myItemsKey, (prev = NO_MY_ITEMS) =>
          prev.some((it) => String(it.itemId) === itemId)
            ? prev
            : [...prev, { itemId: res.itemId ?? Number(itemId), userItemId: res.userItemId }],
        );
        track('shop_purchase', { itemId });
        toast('구매 완료!', 'success');
        return true;
      } catch (err) {
        const broke =
          err instanceof ApiError &&
          err.status === 409 &&
          err.code === ErrorCode.SHOP_INSUFFICIENT_BALANCE;
        toast(broke ? '다이아가 부족해요' : '구매에 실패했어요', 'error');
        return false;
      }
    },
    [purchaseAsync, qc, myItemsKey, setWallet, toast],
  );

  /**
   * Re-sync the inventory after items were acquired outside the shop (AI
   * 가구 스튜디오) — otherwise fresh items keep showing as buyable in 방 꾸미기
   * and can't be placed (their userItemId is unknown to placement saves).
   * Returns whether both refetches succeeded — the studio blocks navigation
   * on false.
   */
  const refreshOwned = useCallback(async () => {
    const [cat, mine] = await Promise.all([refetchItems(), refetchMyItems()]);
    return cat.status === 'success' && mine.status === 'success';
  }, [refetchItems, refetchMyItems]);

  const { mutateAsync: saveAsync } = useMutation({ mutationFn: updateRoomLayout });
  // 저장 본문은 최신 리비전·인벤토리로 만든다 — ref로 읽어 saveLayout 참조를 고정.
  const revisionRef = useLatestRef(placement.layoutRevision);
  const userItemMapRef = useLatestRef(userItemMap);

  /**
   * 자유 배치 저장 (PUT /rooms/me/layout, #327). 'conflict'는 다른 기기가 먼저
   * 저장한 경우(409 REVISION_CONFLICT) — 화면이 재로드 모달을 띄운다.
   */
  const saveLayout = useCallback(
    async (
      items: PlacedFurniture[],
      wallpaperId: string,
      floorId: string | null = null,
      backgroundId: string | null = null,
    ): Promise<'ok' | 'conflict' | 'fail'> => {
      const map = userItemMapRef.current;
      const baseRevision = revisionRef.current;
      const surfaceUid = (id: string | null) => (id ? (map.get(id) ?? null) : null);
      const body = {
        baseRevision,
        surfaceSlots: [
          { slotType: 'wallpaper', userItemId: surfaceUid(wallpaperId) },
          { slotType: 'floor', userItemId: surfaceUid(floorId) },
          { slotType: 'background', userItemId: surfaceUid(backgroundId) },
        ],
        placements: toLayoutPlacements(items, map),
      };
      try {
        const res = await saveAsync(body);
        // 보낸 본문을 방 캐시에 그대로 — 재조회 없이 placement가 저장한 모습이
        // 된다(재조회해도 같은 답). 거미줄은 배치 저장과 무관하니 그대로 (#829).
        qc.setQueryData<RoomWithLayout>(myRoomKey, (prev) => ({
          ...prev,
          layoutRevision: res.layoutRevision ?? baseRevision + 1,
          placements: body.placements,
          slots: body.surfaceSlots.filter(
            (s): s is { slotType: string; userItemId: number } => s.userItemId != null,
          ),
        }));
        toast('방 배치를 저장했어요', 'success');
        return 'ok';
      } catch (err) {
        if (err instanceof ApiError && err.code === ErrorCode.ROOM_LAYOUT_REVISION_CONFLICT) {
          return 'conflict';
        }
        toast('방 배치 저장에 실패했어요', 'error');
        return 'fail';
      }
    },
    [saveAsync, qc, myRoomKey, revisionRef, userItemMapRef, toast],
  );

  return useMemo(
    () => ({
      growthLevel: room?.growthLevel,
      growthPoints: room?.growthPoints,
      pointsToNextLevel: room?.pointsToNextLevel,
      catalogue,
      ownedIds,
      placement,
      loading,
      error,
      retry,
      purchase,
      cleanCobweb,
      refreshOwned,
      saveLayout,
    }),
    [
      room?.growthLevel,
      room?.growthPoints,
      room?.pointsToNextLevel,
      catalogue,
      ownedIds,
      placement,
      loading,
      error,
      retry,
      purchase,
      cleanCobweb,
      refreshOwned,
      saveLayout,
    ],
  );
}
