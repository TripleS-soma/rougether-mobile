import { Image } from 'expo-image';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { type Screen } from '@/components/app/navigation';
import type { useFriendVisit } from '@/components/app/use-friend-visit';
import type { useMissionLinks } from '@/components/app/use-mission-links';
import { houseCoverKey } from '@/components/room/house-preview-frame';
import { CreateHouseScreen } from '@/components/screens/create-house-screen';
import {
  type House,
  type HouseEditInput,
  type NewHouseMission,
} from '@/components/screens/house-screen';
import { HouseMissionsScreen } from '@/components/screens/house-missions-screen';
import { HouseMembersScreen, manageableMembers } from '@/components/screens/house-members-screen';
import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { type CharacterId } from '@/constants/characters';
import { type Wallet } from '@/constants/currency';
import { useHouseCovers } from '@/hooks/use-house-covers';
import type { useHouses } from '@/hooks/use-houses';
import {
  characterIdForMember,
  useMemberRoomPreviews,
  withMyCharacter,
} from '@/hooks/use-member-room-previews';
import type { OnboardingMissionStepId } from '@/hooks/use-onboarding-missions';
import type { useRoomLayouts } from '@/hooks/use-room-layouts';
import { clearPendingInviteCode, subscribePendingInviteCode } from '@/lib/pending-invite';
import { assetSource } from '@/resources/asset';
import type { ShopCatalogue } from '@/api/adapters';

type HousesData = ReturnType<typeof useHouses>;
type MissionLinks = ReturnType<typeof useMissionLinks>;
type FriendVisit = ReturnType<typeof useFriendVisit>;

/**
 * 집 페이지 배선 (#692 6단계) — 집 탭 페이지와 그 서브화면 2종(집 탐색·집
 * 생성)의 훅·콜백·JSX를 소유한다. 초대 코드(#624)·둘러보기 판정 ref(#571
 * 후속)는 서브화면 이동으로 탭 페이저가 언마운트돼도 유지돼야 하므로 항상
 * 마운트된 셸 수명에서 이 훅으로 산다 (설정 서피스와 같은 제약, #692 2단계
 * 참조). 셸은 `tabProps`를 `<HouseScreen {...tabProps} />`로 스프레드하고
 * `subScreen`을 렌더만 한다. `houseIndex` 상태·미션 연동(use-mission-links)·
 * 친구 방문(use-friend-visit)은 이 훅보다 먼저 서야 해서(집 스위처 인덱스를
 * 양쪽이 소비) 셸에 남고, 파생값·함수만 파라미터로 받는다.
 */
export function useHousePages({
  nav,
  data,
  houseIndex,
  setHouseIndex,
  currentHouse,
  arranged,
  missionLinks,
  visitFriend,
  openMyRoom,
  completeMission,
  catalogue,
  shopLoading,
  wallet,
  raining,
  nickname,
  streak,
  selectedCharacterId,
  wornCharacterId,
  onPagerLockChange,
  roomPreviewStore,
}: {
  /** 셸 내비 상태 — screen 상태는 셸 소유(useState setter 계약, #692). */
  nav: { screen: Screen; setScreen: Dispatch<SetStateAction<Screen>> };
  /** useHouses 파생값 — 호출 자체는 교차 도메인 소비자(미션 연동·친구 방문·
   * 방 배치)가 있어 셸에 남고, 이 훅은 필요한 조각만 받는다. */
  data: Pick<
    HousesData,
    | 'houses'
    | 'searchHouses'
    | 'searchHasNext'
    | 'searchLoadingMore'
    | 'loadMoreSearch'
    | 'loading'
    | 'searchLoading'
    | 'error'
    | 'searchError'
    | 'retry'
    | 'retrySearch'
    | 'refreshHouses'
    | 'pendingJoinRequests'
    | 'cancelJoinRequest'
    | 'reorderHouses'
    | 'previewByCode'
    | 'previewHouse'
    | 'joinByCode'
    | 'joinHouse'
    | 'acceptJoinRequest'
    | 'rejectJoinRequest'
    | 'create'
    | 'kickMember'
    | 'claimMission'
    | 'createMission'
    | 'updateHouse'
    | 'transferOwnership'
    | 'reissueInviteCode'
  >;
  /** 집 스위처 인덱스 — 친구 방문(스와이프 순회)·미션 연동(현재 집)이 이 훅
   * 앞에서 소비해 상태는 셸 소유. currentHouse도 같은 이유로 셸이 파생. */
  houseIndex: number;
  setHouseIndex: Dispatch<SetStateAction<number>>;
  currentHouse: House | undefined;
  /** 자리 배치 반영된 집 목록 (#278) — 셸 잔류 훅(useRoomLayouts)의 반환. */
  arranged: {
    arrangedHouses: House[];
    swapSeats: ReturnType<typeof useRoomLayouts>['swapSeats'];
  };
  /** 공동미션 ↔ 루틴 연동 (#272 → #578) — 나가기/미션 삭제의 연동 정리 포함. */
  missionLinks: {
    leaveHouseWithLinked: MissionLinks['leaveHouseWithLinked'];
    deleteMissionWithLinked: MissionLinks['deleteMissionWithLinked'];
    removeMissionRoutine: MissionLinks['removeMissionRoutine'];
    addMissionRoutine: MissionLinks['addMissionRoutine'];
    houseLinkedRoutines: MissionLinks['houseLinkedRoutines'];
    contributedMissionIdList: MissionLinks['contributedMissionIdList'];
  };
  /** 친구 방 방문 (#149·#644) — use-friend-visit이 셸에서 배선해 넘긴다. */
  visitFriend: FriendVisit['visitFriend'];
  /** 집 화면 '내 방으로' — use-my-room-pages 반환값. */
  openMyRoom: () => void;
  /** 온보딩 미션 완료 (#571) — 셸이 넘겨 미션 체인을 진행시킨다. */
  completeMission: (id: OnboardingMissionStepId) => void;
  /** 상점 카탈로그 — 방 미리보기·집 미리보기의 assetKey 해석. */
  catalogue: ShopCatalogue;
  shopLoading: boolean;
  wallet: Wallet;
  /** 집 하늘 연출용 현재 비 여부 (#360). */
  raining: boolean;
  nickname: string;
  streak: number;
  /** 서버 확정 착용 캐릭터 id — 프리뷰 내 좌석 파생(#282)은 미로드(undefined)
   * 를 구분해야 해서 폴백 없는 원본을 받는다. */
  selectedCharacterId: CharacterId | undefined;
  wornCharacterId: CharacterId;
  /** 집 확대·자리 드래그 중 탭 페이저 잠금 — 페이저와 결합된 셸 잔류 콜백. */
  onPagerLockChange: (locked: boolean) => void;
  /**
   * 멤버 방 프리뷰 저장소 — 셸이 소유한다 (#831). 친구 방에서 거미줄을
   * 치우면 좌석 타일의 거미줄도 걷어야 하는데, 여기서 훅을 호출하면
   * 그보다 먼저 서는 use-friend-visit이 같은 인스턴스에 닿지 못한다.
   */
  roomPreviewStore: ReturnType<typeof useMemberRoomPreviews>;
}) {
  const { screen, setScreen } = nav;
  const {
    houses,
    searchHouses,
    searchHasNext,
    searchLoadingMore,
    loadMoreSearch,
    loading: housesLoading,
    searchLoading,
    error: housesError,
    searchError,
    retry: retryHouses,
    retrySearch,
    refreshHouses,
    pendingJoinRequests,
    cancelJoinRequest,
    reorderHouses,
    previewByCode,
    previewHouse,
    joinByCode,
    joinHouse: joinSearchHouse,
    acceptJoinRequest,
    rejectJoinRequest,
    create: createHouse,
    kickMember,
    claimMission,
    createMission,
    updateHouse,
    transferOwnership,
    reissueInviteCode,
  } = data;
  const { arrangedHouses, swapSeats } = arranged;
  const {
    leaveHouseWithLinked,
    deleteMissionWithLinked,
    removeMissionRoutine,
    addMissionRoutine,
    houseLinkedRoutines,
    contributedMissionIdList,
  } = missionLinks;

  // 당겨서 새로고침 (#454) — 실패해도 조용히 접는다(각 훅이 상태를 유지하고,
  // 인디케이터는 어차피 되돌아간다). 집은 목록 리로드 (나의 방은 use-my-room-pages).
  const refreshHousePull = useCallback(async () => {
    try {
      await refreshHouses();
    } catch {
      // 유지.
    }
  }, [refreshHouses]);

  // 승인 대기 신청 → 잠금 카드 뷰모델 (#648). memo 화면으로 가는 파생 배열이라
  // 참조 안정화(useMemo) 필수 (#539 계약).
  const pendingHouseCards = useMemo(
    () =>
      pendingJoinRequests
        .filter((r) => r.requestId != null)
        .map((r) => ({
          requestId: r.requestId!,
          name: r.houseName ?? '이름 없는 집',
          requestedAt: r.requestedAt,
        })),
    [pendingJoinRequests],
  );

  // 집 커버는 원격(S3)이고 house 화면은 탭 진입 때 처음 마운트돼, 그때부터
  // fetch가 시작되면 프레임이 늦게 뜬다 (#463). 항상 마운트된 셸에서 집 목록이
  // 오면 모든 커버(현재+스위처 대상)를 미리 디스크 캐시에 데워 둔다.
  useEffect(() => {
    const uris = houses.map((h) => assetSource(houseCoverKey(h.coverImageKey)).uri);
    if (uris.length) void Image.prefetch?.(uris, { cachePolicy: 'memory-disk' });
  }, [houses]);

  // 집이 없는 유저 (#571) — 집 탭은 빈 상태 대신 집 탐색으로 직행하고,
  // 탐색의 뒤로가기도 (빈) 집 화면 대신 나의 방으로 돌아간다. 로딩/에러
  // 중엔 판정하지 않아 집이 있는 유저가 탐색으로 튕기지 않는다.
  const noHouses = !housesLoading && !housesError && houses.length === 0;

  // 초대 링크로 받은 코드 (#624) — 집 탐색을 열고 코드 미리보기를 자동 실행.
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);
  useEffect(
    () =>
      subscribePendingInviteCode((code) => {
        setPendingJoinCode(code);
        setScreen('houseSearch');
      }),
    // setScreen은 안정 참조 — 마운트 1회 구독.
    [setScreen],
  );
  // 소비는 화면(자동 미리보기 발화 시점)이 알려온다 — 마운트 직후 screen이
  // 아직 'myRoom'인 채로 도는 클리어 이펙트가 코드를 지우던 콜드 스타트
  // 레이스(#624 후속)의 수정. 화면 감시 클리어는 두지 않는다.

  // Mini room previews for the current house's member tiles (#268).
  const { previews: memberRoomPreviews, load: loadRoomPreviews } = roomPreviewStore;
  // 캐릭터 교체가 집 화면 내 타일에 즉시 반영되도록(#282), 캐시된 프리뷰 위에
  // 내 좌석의 캐릭터만 착용 캐릭터로 파생한다 (서버 재조회 없음).
  const roomPreviews = useMemo(
    () => withMyCharacter(memberRoomPreviews, houses, selectedCharacterId),
    [memberRoomPreviews, houses, selectedCharacterId],
  );
  useEffect(() => {
    if (screen !== 'house' || !currentHouse?.houseId) return;
    const membershipIds = currentHouse.floors
      .flatMap((f) => f.rooms.map((r) => r.membershipId))
      .filter((id): id is number => id != null);
    // catalogueReady=!shopLoading: an EMPTY pre-load catalogue must not fill
    // the per-house cache with blank rooms (the effect re-fires when it lands).
    void loadRoomPreviews(currentHouse.houseId, membershipIds, catalogue, !shopLoading);
  }, [screen, currentHouse, catalogue, shopLoading, loadRoomPreviews]);

  // Selectable house-cover catalog (집 생성·집 정보 수정).
  const { covers: houseCovers } = useHouseCovers();

  // --- memo 화면(HouseScreen)으로 가는 콜백/파생 prop (#539) ---
  // 인라인 화살표·렌더마다 새로 만드는 객체는 memo 경계를 무효화한다. 매 렌더
  // 마운트되지 않는 서브화면 2종은 인라인을 유지한다.
  const openHouseSearch = useCallback(() => setScreen('houseSearch'), [setScreen]);
  // 온보딩 미션 '집에 친구 초대하기' (#841) — 코드를 복사·공유한 순간 완료.
  const handleInviteShared = useCallback(() => completeMission('invite-house'), [completeMission]);
  // --- 구성원 관리 (#753) — HouseScreen 내부 뷰에서 셸 화면으로 승격 ---
  // 강퇴 낙관 반영: 서버 목록이 갱신되기 전에도 좌석 타일이 즉시 빈다.
  // 키는 `${houseIndex}-${name}` — 집을 오가도 다른 집 좌석에 새지 않는다.
  const [kicked, setKicked] = useState<string[]>([]);
  const isKickedMember = useCallback(
    (name: string) => kicked.includes(`${houseIndex}-${name}`),
    [kicked, houseIndex],
  );
  const localKick = useCallback(
    (name: string) => setKicked((prev) => [...prev, `${houseIndex}-${name}`]),
    [houseIndex],
  );
  const openMembers = useCallback(() => {
    // 방장 진입 시 구성원·입주 신청 목록 갱신 (#526).
    if (currentHouse?.myRole === 'OWNER' && currentHouse.houseId) void refreshHouses();
    setScreen('houseMembers');
  }, [currentHouse, refreshHouses, setScreen]);
  const closeMembers = useCallback(() => setScreen('house'), [setScreen]);
  // 공동 미션 화면 (#875) — 예전엔 집 화면 위 모달이었다.
  const openMissions = useCallback(() => setScreen('houseMissions'), [setScreen]);
  const closeMissions = useCallback(() => setScreen('house'), [setScreen]);
  // 관리 중 집이 사라지면(마지막 집 나가기·삭제, 갱신으로 강퇴 확인 등) 집
  // 탭으로 돌린다 — currentHouse 없는 구성원 화면은 그릴 것이 없다.
  useEffect(() => {
    if ((screen === 'houseMembers' || screen === 'houseMissions') && !currentHouse)
      setScreen('house');
  }, [screen, currentHouse, setScreen]);
  const handleAcceptJoinRequest = useCallback(
    (houseId: number, requestId: number) => {
      void acceptJoinRequest(houseId, requestId);
    },
    [acceptJoinRequest],
  );
  const handleRejectJoinRequest = useCallback(
    (houseId: number, requestId: number) => {
      void rejectJoinRequest(houseId, requestId);
    },
    [rejectJoinRequest],
  );
  const handleKickMember = useCallback(
    (houseId: number, membershipId: number) => {
      void kickMember(houseId, membershipId);
    },
    [kickMember],
  );
  const handleLeaveHouse = useCallback(
    (houseId: number) => {
      void leaveHouseWithLinked(houseId);
    },
    [leaveHouseWithLinked],
  );
  const handleAddMissionRoutine = useCallback(
    (houseId: number, mission: { id: number; title: string }) => {
      void addMissionRoutine(houseId, mission);
    },
    [addMissionRoutine],
  );
  const handleClaimMission = useCallback(
    (houseId: number, missionId: number) => {
      void claimMission(houseId, missionId);
    },
    [claimMission],
  );
  const handleCreateMission = useCallback(
    (houseId: number, input: NewHouseMission) => {
      void createMission(houseId, input);
    },
    [createMission],
  );
  const handleDeleteMission = useCallback(
    (houseId: number, missionId: number) => {
      void deleteMissionWithLinked(houseId, missionId);
    },
    [deleteMissionWithLinked],
  );
  const handleRemoveMissionRoutine = useCallback(
    (mission: { id: number }) => {
      void removeMissionRoutine(mission.id);
    },
    [removeMissionRoutine],
  );
  const handleUpdateHouse = useCallback(
    (houseId: number, input: HouseEditInput) => {
      void updateHouse(houseId, input);
    },
    [updateHouse],
  );
  const handleTransferOwnership = useCallback(
    (houseId: number, membershipId: number) => {
      void transferOwnership(houseId, membershipId);
    },
    [transferOwnership],
  );
  const handleReissueInviteCode = useCallback(
    (houseId: number) => reissueInviteCode(houseId),
    [reissueInviteCode],
  );

  /** 탭 페이저의 집 페이지 prop — `<HouseScreen {...tabProps} />`. */
  const tabProps = {
    houses: arrangedHouses,
    pendingHouses: pendingHouseCards,
    onCancelJoinRequest: cancelJoinRequest,
    onReorderHouses: reorderHouses,
    onSwapSeats: swapSeats,
    loading: housesLoading,
    loadError: housesError,
    onRetry: retryHouses,
    onRefresh: refreshHousePull,
    covers: houseCovers,
    characterId: wornCharacterId,
    userName: nickname,
    streakDays: streak,
    roomPreviews,
    furniture: catalogue.furniture,
    wallpapers: catalogue.wallpapers,
    floors: catalogue.floors,
    backgrounds: catalogue.backgrounds,
    houseIndex,
    onHouseIndexChange: setHouseIndex,
    onVisitFriend: visitFriend,
    onVisitMyRoom: openMyRoom,
    onOpenSearch: openHouseSearch,
    coinBalance: wallet.coin,
    diamondBalance: wallet.diamond,
    raining,
    onOpenMembers: openMembers,
    isKickedMember,
    onAcceptJoinRequest: handleAcceptJoinRequest,
    onRejectJoinRequest: handleRejectJoinRequest,
    onKickMember: handleKickMember,
    onLeaveHouse: handleLeaveHouse,
    linkedRoutines: houseLinkedRoutines,
    contributedMissionIds: contributedMissionIdList,
    onAddMissionRoutine: handleAddMissionRoutine,
    onRemoveMissionRoutine: handleRemoveMissionRoutine,
    onClaimMission: handleClaimMission,
    onCreateMission: handleCreateMission,
    onDeleteMission: handleDeleteMission,
    onOpenMissions: openMissions,
    onUpdateHouse: handleUpdateHouse,
    onTransferOwnership: handleTransferOwnership,
    onReissueInviteCode: handleReissueInviteCode,
    onPagerLockChange,
  };

  /** 현재 화면이 집 서브화면 3종이면 그 JSX, 아니면 null — 셸이 그대로 렌더. */
  const subScreen =
    screen === 'houseMissions' && currentHouse ? (
      <HouseMissionsScreen
        house={currentHouse}
        missions={currentHouse.missions ?? []}
        isOwner={currentHouse.myRole === 'OWNER' && !!currentHouse.houseId}
        linkedRoutines={houseLinkedRoutines}
        contributedMissionIds={contributedMissionIdList}
        onBack={closeMissions}
        onCreateMission={handleCreateMission}
        onDeleteMission={handleDeleteMission}
        onClaimMission={handleClaimMission}
        onAddMissionRoutine={handleAddMissionRoutine}
        onRemoveMissionRoutine={handleRemoveMissionRoutine}
      />
    ) : screen === 'houseMembers' && currentHouse ? (
      <HouseMembersScreen
        house={currentHouse}
        members={manageableMembers(currentHouse)}
        isOwner={currentHouse.myRole === 'OWNER' && !!currentHouse.houseId}
        covers={houseCovers}
        isKicked={isKickedMember}
        memberCharacterId={(m) => characterIdForMember(m, roomPreviews, wornCharacterId)}
        onBack={closeMembers}
        onInviteShared={handleInviteShared}
        onKickMember={handleKickMember}
        onAcceptJoinRequest={handleAcceptJoinRequest}
        onRejectJoinRequest={handleRejectJoinRequest}
        onLocalKick={localKick}
        onTransferOwnership={handleTransferOwnership}
        onReissueInviteCode={handleReissueInviteCode}
        onUpdateHouse={handleUpdateHouse}
        onLeaveHouse={handleLeaveHouse}
        onLeaveDone={closeMembers}
      />
    ) : screen === 'houseSearch' ? (
      <HouseSearchScreen
        initialCode={pendingJoinCode ?? undefined}
        onInitialCodeConsumed={() => {
          setPendingJoinCode(null);
          // 모듈 보관분도 여기서 비운다 — 그 전까지는 셸이 다시 구독해도
          // 코드가 살아남아 유실을 복구한다 (#896).
          clearPendingInviteCode();
        }}
        houses={searchHouses}
        hasNext={searchHasNext}
        loadingMore={searchLoadingMore}
        onLoadMore={() => {
          void loadMoreSearch();
        }}
        loading={searchLoading}
        loadError={searchError}
        onRetry={retrySearch}
        onBack={() => setScreen(noHouses ? 'myRoom' : 'house')}
        onJoinByCode={async (code) => {
          const ok = await joinByCode(code);
          if (ok === true) setScreen('house');
          return ok;
        }}
        onPreviewCode={(code) => previewByCode(code)}
        // 카탈로그를 얹어 미리보기 창문에 실제 방을 그린다 (#386).
        onPreviewHouse={(houseId) => previewHouse(houseId, catalogue)}
        furniture={catalogue.furniture}
        wallpapers={catalogue.wallpapers}
        floors={catalogue.floors}
        backgrounds={catalogue.backgrounds}
        onJoinHouse={(houseId) => {
          void joinSearchHouse(houseId).then((ok) => {
            if (ok) setScreen('house');
          });
        }}
        onCreate={() => setScreen('createHouse')}
      />
    ) : screen === 'createHouse' ? (
      <CreateHouseScreen
        covers={houseCovers}
        onBack={() => setScreen('houseSearch')}
        onCreate={(input) => {
          void createHouse(input).then((ok) => ok && setScreen('house'));
        }}
      />
    ) : null;

  return {
    tabProps,
    subScreen,
    /** 집 없는 유저 판정 (#571) — 셸의 내비(useAppNavigation)·BottomNav가 쓴다. */
    noHouses,
    /** 탐색을 뒤로 떠나는 순간의 미션 판정 — 셸이 useAppNavigation에 넘긴다. */
  };
}
