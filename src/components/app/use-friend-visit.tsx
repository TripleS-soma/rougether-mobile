import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import { type Screen } from '@/components/app/navigation';
import { FriendRoomScreen, type CheerType } from '@/components/screens/friend-room-screen';
import { type House, type VisitedFriend } from '@/components/screens/house-screen';
import { useToast } from '@/components/ui/toast';
import { useFriendRoom } from '@/hooks/use-friend-room';
import { useGuestbook } from '@/hooks/use-guestbook';
import type { ShopCatalogue } from '@/api/adapters';
import { track } from '@/lib/analytics';

/**
 * 친구 방문 클러스터 (#149·#644, #692 4단계) — 방문 중인 친구 상태와
 * 방·방명록 로드, 좌우 스와이프 순회, FriendRoomScreen JSX를 소유한다.
 * HouseScreen이 방문 중 언마운트돼도 방문 상태가 유지되도록 항상 마운트된
 * 셸 수명에서 훅으로 산다 (설정 서피스와 같은 제약, #692 2단계 참조).
 */
export function useFriendVisit({
  setScreen,
  catalogue,
  arrangedHouses,
  houseIndex,
  screen,
  cheerMember,
  clearPreviewCobweb,
}: {
  setScreen: Dispatch<SetStateAction<Screen>>;
  /** 상점 카탈로그 — 친구 방 가구·표면의 assetKey 해석 (#149). */
  catalogue: ShopCatalogue;
  /** 자리 배치 반영된 집 목록 (#278) — 스와이프 순회 순서의 근거. */
  arrangedHouses: House[];
  houseIndex: number;
  screen: Screen;
  /** 같은 집 활성 멤버 응원 (#330). */
  cheerMember: (houseId: number, membershipId: number, type: CheerType) => Promise<unknown>;
  /** 그 멤버 타일의 거미줄만 걷는다 (#831). */
  clearPreviewCobweb: (membershipId: number) => void;
}) {
  const { show: toast } = useToast();
  const [visitingFriend, setVisitingFriend] = useState<VisitedFriend>({ name: '친구' });
  // The visited friend's live room + today's routines (loads on visit, #149).
  const { friendRoom, load: loadFriendRoom, cleanCobweb } = useFriendRoom();
  // Guestbook for the friend room being visited (loads on visit).
  const {
    entries: guestbookEntries,
    loading: guestbookLoading,
    hasNext: guestbookHasNext,
    load: loadGuestbook,
    loadMore: loadMoreGuestbook,
    write: writeGuestbook,
  } = useGuestbook();

  const visitFriend = useCallback(
    (friend: VisitedFriend) => {
      track('friend_room_visit');
      setVisitingFriend(friend);
      void loadGuestbook(friend.userId, friend.houseId);
      void loadFriendRoom(friend.houseId, friend.membershipId, catalogue);
      setScreen('friendRoom');
    },
    [loadGuestbook, loadFriendRoom, catalogue, setScreen],
  );
  // 친구 방 좌우 스와이프 순회 (#644) — 현재 집의 자리 배치 순서로, 빈자리·
  // 내 방은 건너뛰고 순환한다. 방문 가능한 친구가 1명뿐이면 스와이프 없음.
  const visitableFriends = useMemo<VisitedFriend[]>(() => {
    const house = arrangedHouses[houseIndex] ?? arrangedHouses[0];
    if (!house) return [];
    return house.floors
      .flatMap((f) => f.rooms)
      .filter((r) => !r.vacant && !r.isMine && r.membershipId != null)
      .map((r) => ({
        name: r.name,
        userId: r.userId,
        houseId: house.houseId,
        membershipId: r.membershipId,
      }));
  }, [arrangedHouses, houseIndex]);
  const swipeFriend = useCallback(
    (dir: 'left' | 'right') => {
      const list = visitableFriends;
      if (list.length < 2) return;
      const i = Math.max(
        0,
        list.findIndex((f) => f.membershipId === visitingFriend.membershipId),
      );
      // 왼쪽 플링 = 다음 멤버 (페이저 문법과 동일 방향감).
      const next = list[(i + (dir === 'left' ? 1 : list.length - 1)) % list.length];
      visitFriend(next);
    },
    [visitableFriends, visitingFriend.membershipId, visitFriend],
  );

  // 방문 실패 시 다시 시도 (#549) — 같은 친구의 방·방명록을 다시 불러온다.
  const retryFriendRoomVisit = useCallback(() => {
    void loadGuestbook(visitingFriend.userId, visitingFriend.houseId);
    void loadFriendRoom(visitingFriend.houseId, visitingFriend.membershipId, catalogue);
  }, [loadGuestbook, loadFriendRoom, visitingFriend, catalogue]);

  /** 친구 방 서브화면 — screen === 'friendRoom'일 때만 JSX, 아니면 null. */
  const subScreen =
    screen === 'friendRoom' ? (
      <FriendRoomScreen
        friendName={visitingFriend.name}
        onSwipeFriend={visitableFriends.length >= 2 ? swipeFriend : undefined}
        guestbook={guestbookEntries}
        guestbookLoading={guestbookLoading}
        guestbookHasNext={guestbookHasNext}
        onWriteGuestbook={(content) => {
          void writeGuestbook(content);
        }}
        onCheer={(type) => {
          // 응원은 같은 집 활성 멤버 사이에서만 — 서버 집 문맥이 있을 때만 배선.
          const { houseId, membershipId } = visitingFriend;
          if (houseId && membershipId) void cheerMember(houseId, membershipId, type);
          else toast('이 방에서는 응원을 보낼 수 없어요', 'error');
        }}
        onLoadMoreGuestbook={() => {
          void loadMoreGuestbook();
        }}
        placements={friendRoom.placement?.placements ?? []}
        wallpaperId={friendRoom.placement?.wallpaperId}
        floorId={friendRoom.placement?.floorId ?? null}
        backgroundId={friendRoom.placement?.backgroundId ?? null}
        furniture={catalogue.furniture}
        wallpapers={catalogue.wallpapers}
        floors={catalogue.floors}
        backgrounds={catalogue.backgrounds}
        characterId={friendRoom.characterId}
        characterFrames={friendRoom.characterFrames}
        streakDays={friendRoom.streakDays}
        cobweb={friendRoom.cobweb}
        onCleanCobweb={async () => {
          // 응원과 같은 조건 — 서버 집 문맥이 있을 때만 청소가 성립한다.
          const { houseId, membershipId } = visitingFriend;
          if (!houseId || !membershipId) return null;
          try {
            const reward = await cleanCobweb(houseId, membershipId);
            if (reward == null) toast('누가 먼저 치워줬어요');
            // 타일에 남은 거미줄도 같이 걷는다 — 돌아갔을 때 이미 치운 게
            // 그대로 껴 있으면 청소가 안 먹힌 것처럼 보인다.
            else clearPreviewCobweb(membershipId);
            return reward;
          } catch {
            toast('거미줄을 치우지 못했어요. 잠시 후 다시 시도해 주세요.', 'error');
            return null;
          }
        }}
        routines={friendRoom.routines}
        categories={friendRoom.categories}
        recentActivity={friendRoom.recentActivity}
        loading={friendRoom.loading}
        loadError={friendRoom.error}
        onRetry={retryFriendRoomVisit}
        onBack={() => setScreen('house')}
      />
    ) : null;

  return { visitFriend, subScreen };
}
