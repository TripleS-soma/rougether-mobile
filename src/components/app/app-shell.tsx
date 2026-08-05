import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import {
  NAV_ORDER,
  SCREEN_FOR_TAB,
  type Screen,
  TAB_FOR_SCREEN,
} from '@/components/app/navigation';
import { TabPager } from '@/components/app/tab-pager';
import { useAppNavigation } from '@/components/app/use-app-navigation';
import { useFriendVisit } from '@/components/app/use-friend-visit';
import { useMissionLinks } from '@/components/app/use-mission-links';
import { useMyRoomPages } from '@/components/app/use-my-room-pages';
import { useSettingsSurface } from '@/components/app/use-settings-surface';
import { CreateHouseScreen } from '@/components/screens/create-house-screen';
import { GachaScreen } from '@/components/screens/gacha-screen';
import {
  type HouseEditInput,
  HouseScreen,
  type NewHouseMission,
} from '@/components/screens/house-screen';
import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { isScheduledOn, MyRoomScreen } from '@/components/screens/my-room-screen';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';
import { houseCoverKey } from '@/components/room/house-preview-frame';
import { MissionSheet } from '@/components/screens/sheets/mission-sheet';
import { BottomNav } from '@/components/ui/bottom-nav';
import { MissionBanner } from '@/components/ui/mission-banner';
import { DEFAULT_CHARACTER_ID, type CharacterId } from '@/constants/characters';
import { screenView } from '@/lib/analytics';
import { todayIso } from '@/utils/datetime';
import { refreshWidgets } from '@/widgets/rougether-widgets';
import { buildWidgetSummary, saveWidgetSummary } from '@/widgets/widget-data';
import { useGacha } from '@/hooks/use-gacha';
import {
  type OnboardingMissionStepId,
  useOnboardingMissions,
} from '@/hooks/use-onboarding-missions';
import { useHouseCovers } from '@/hooks/use-house-covers';
import { useHouses } from '@/hooks/use-houses';
import { useMemberRoomPreviews, withMyCharacter } from '@/hooks/use-member-room-previews';
import { useRoomLayouts } from '@/hooks/use-room-layouts';
import { useMyCharacters } from '@/hooks/use-my-characters';
import { useMyRoomData } from '@/hooks/use-my-room-data';
import { useShop } from '@/hooks/use-shop';
import { useWeather } from '@/hooks/use-weather';
import type { DrawResult } from '@/api';
import { fetchGachaRewards } from '@/api';
import { subscribePendingInviteCode } from '@/lib/pending-invite';
import { assetSource } from '@/resources/asset';
import { DEFAULT_WALLPAPER_ID, type PlacedFurniture } from '@/resources/furniture';

// 내비게이션 상수·backTargetFor는 navigation.ts로 이동 (#692) — 기존
// 임포터(테스트 등)를 위한 재수출.
export { backTargetFor, type Screen } from '@/components/app/navigation';

export type AppShellProps = {
  /** Character chosen at onboarding; defaults to the sample character. */
  characterId?: CharacterId;
  /** Re-run the onboarding (설정 → 튜토리얼 다시 보기 → 온보딩 → 미션 체인). */
  onReplayOnboarding?: () => void;
  /** 온보딩을 방금 마쳤음 — 온보딩 미션 체인을 시작한다 (#571, 구 코치마크 #351). */
  startMissions?: boolean;
};

/** 각 미션의 진입 화면 (#571) — 배너 탭·완료 시트 '하러 가기'의 목적지. */
const MISSION_TARGET_SCREEN: Record<OnboardingMissionStepId, Screen> = {
  'register-routine': 'addRoutine',
  'first-draw': 'gacha',
  'place-furniture': 'decor',
  'browse-house': 'houseSearch',
};

/** 미션 진행 배너를 얹는 화면들 — 미션과 관련된 탭·서브화면 상단. */
const MISSION_BANNER_SCREENS: ReadonlySet<Screen> = new Set<Screen>([
  'myRoom',
  'addRoutine',
  'decor',
  'gacha',
  'house',
  'houseSearch',
]);

/**
 * The app shell that wires every non-auth screen together with shared state:
 * 나의 방 / 집 / 설정 tabs plus the pushed sub-screens (decor, routine manage/add,
 * gacha, friend room, house search/create). Mirrors the prototype App.tsx
 * navigation, minus the auth flow.
 */
export function AppShell({
  characterId = DEFAULT_CHARACTER_ID,
  onReplayOnboarding,
  startMissions = false,
}: AppShellProps) {
  // 집 하늘 연출용 현재 비 여부 (#360) — 서울 고정, 30분 캐시.
  const { raining } = useWeather();
  const [screen, setScreen] = useState<Screen>('myRoom');
  // Remember where the add/edit-routine screen was opened from, so its back
  // button returns to the right place (my-room or routine manage).
  const [addReturnScreen, setAddReturnScreen] = useState<Screen>('routineManage');

  // 온보딩 미션 체인 (#571) — 온보딩 완주 직후 시작, 완료/스킵 플래그가
  // 있으면 시작하지 않는다. 단계 완료는 아래 액션 지점들이 complete로 쏜다.
  const missions = useOnboardingMissions(startMissions);
  const completeMission = missions.complete;

  // Routines / todos / categories / completion / wallet come from the API.
  // 전체 객체는 use-my-room-pages(나의 방 탭·서브화면 배선, #692 5단계)로
  // 흘러가고, 셸은 교차 도메인 소비자(위젯 요약·미션 연동·프로필·상점 지갑)
  // 가 쓰는 조각만 여기서 푼다.
  const myRoomData = useMyRoomData();
  const {
    routines,
    completions,
    categories,
    wallet,
    setWallet,
    nickname: apiNickname,
    bio: apiBio,
    streak,
    loading: myRoomLoading,
    toggleCompletion,
    saveProfile,
    addRoutine,
    deleteRoutine,
    ensureCategory,
    linkRoutineMission,
    linkCategoryHouse,
    deleteCategoryCascade,
  } = myRoomData;

  // 루틴 등록 성공 = 미션 1 완료 (#571) — 추가 화면과 공동미션 연동 추가 공용.
  const addRoutineWithMission = useCallback(
    async (n: Parameters<typeof addRoutine>[0]) => {
      const ok = await addRoutine(n);
      if (ok) completeMission('register-routine');
      return ok;
    },
    [addRoutine, completeMission],
  );

  // Gacha machines + draw (spend + dupe→diamond handled server-side; wallet synced
  // from the draw response).
  const {
    gachas,
    loading: gachasLoading,
    error: gachasError,
    retry: retryGachas,
    draw: drawGachaMachine,
  } = useGacha(setWallet);

  // Owned characters + worn one (GET /me/characters). Once loaded, the worn
  // character overrides the onboarding pick everywhere but friend rooms.
  const {
    characters: ownedCharacters,
    selectedCharacterId,
    selectedCharacterAnimations: wornCharacterAnimations,
    select: selectWornCharacter,
    reload: reloadMyCharacters,
  } = useMyCharacters();
  const wornCharacterId = selectedCharacterId ?? characterId;
  const wearCharacter = useCallback(
    (serverId: number) => {
      void selectWornCharacter(serverId);
    },
    [selectWornCharacter],
  );

  // Houses (내 집 목록 + 탐색 + 참여/생성/강퇴/나가기) from the API.
  const {
    houses,
    searchHouses,
    loading: housesLoading,
    searchLoading,
    error: housesError,
    searchError,
    retry: retryHouses,
    retrySearch,
    refreshHouses,
    pendingJoinRequests,
    cancelJoinRequest,
    previewByCode,
    previewHouse,
    joinByCode,
    joinHouse: joinSearchHouse,
    acceptJoinRequest,
    rejectJoinRequest,
    create: createHouse,
    contributedMissionIds,
    cheerMember,
    kickMember,
    leaveHouse,
    applyMissionContribution,
    claimMission,
    createMission,
    deleteMission,
    updateHouse,
    transferOwnership,
    reissueInviteCode,
  } = useHouses();

  // 당겨서 새로고침 (#454) — 실패해도 조용히 접는다(각 훅이 상태를 유지하고,
  // 인디케이터는 어차피 되돌아간다). 집은 목록 리로드 (나의 방은 use-my-room-pages).
  const refreshHousePull = useCallback(async () => {
    try {
      await refreshHouses();
    } catch {
      // 유지.
    }
  }, [refreshHouses]);

  // Locally saved tile arrangements (#278) — the 집 화면 shows arranged houses
  // and drag-and-drop swaps persist per viewer+house on this device.
  const { houses: arrangedHouses, swapSeats } = useRoomLayouts(houses);

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

  // 집 탐색 미션(#571 후속)은 "둘러보고 나갈 때" 완료 — 미리보기 성공 시
  // 표시만 해두고, 탐색 화면을 떠나는 순간(뒤로/가입) 완료 시트를 띄운다.
  // 탐색 중에 시트가 화면을 덮지 않게 하기 위함. 판정 ref는 셸 소유 (#692).
  const browsedHouseRef = useRef(false);
  const onLeaveHouseSearch = useCallback(() => {
    if (browsedHouseRef.current) completeMission('browse-house');
  }, [completeMission]);

  // 내비게이션 컨트롤러 (#692) — 뒤로가기·엣지 백·전환 손맛·페이저 정착.
  const { edgeBackPan, activeTab, handlePageChange, transOpacity, transX } = useAppNavigation({
    screen,
    setScreen,
    addReturnScreen,
    noHouses,
    onLeaveHouseSearch,
  });

  // Selectable house-cover catalog (집 생성·집 정보 수정).
  const { covers: houseCovers } = useHouseCovers();

  // Shop catalogue + purchase (diamond via API; wallet synced from the purchase
  // response). Server-side room placement isn't wired yet, so arrangement is
  // client-side — seeded from the owned-items placement.
  const {
    catalogue,
    ownedIds,
    placement,
    loading: shopLoading,
    error: shopError,
    retry: retryShop,
    purchase: purchaseFurniture,
    refreshOwned,
    saveLayout,
  } = useShop(setWallet);

  const [placedItems, setPlacedItems] = useState<PlacedFurniture[]>([]);
  const [placedFurnitureIds, setPlacedFurnitureIds] = useState<string[]>([]);
  const [wallpaperId, setWallpaperId] = useState(DEFAULT_WALLPAPER_ID);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [backgroundId, setBackgroundId] = useState<string | null>(null);
  useEffect(() => {
    setPlacedItems(placement.items);
    setPlacedFurnitureIds(placement.placedFurnitureIds);
    setWallpaperId(placement.wallpaperId);
    setFloorId(placement.floorId);
    setBackgroundId(placement.backgroundId);
  }, [placement]);

  // 뽑기 → 가구 배치하러 가기 (#630, #622 개편) — 방금 뽑은 아이템을 꾸미기
  // 카탈로그에서 NEW로 강조한다. 꾸미기를 떠나면 강조를 비워 일반 진입과 구분.
  const placeableFurnitureIds = useMemo(
    () => catalogue.furniture.map((f) => f.id),
    [catalogue.furniture],
  );
  const [newDecorItemIds, setNewDecorItemIds] = useState<string[]>([]);
  const goPlaceDrawn = useCallback((results: DrawResult[]) => {
    setNewDecorItemIds(results.map((r) => String(r.itemId)).filter(Boolean));
    setScreen('decor');
  }, []);
  useEffect(() => {
    if (screen !== 'decor') setNewDecorItemIds([]);
  }, [screen]);

  // 초대 링크로 받은 코드 (#624) — 집 탐색을 열고 코드 미리보기를 자동 실행.
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);
  useEffect(
    () =>
      subscribePendingInviteCode((code) => {
        setPendingJoinCode(code);
        setScreen('houseSearch');
      }),
    [],
  );
  // 소비는 화면(자동 미리보기 발화 시점)이 알려온다 — 마운트 직후 screen이
  // 아직 'myRoom'인 채로 도는 클리어 이펙트가 코드를 지우던 콜드 스타트
  // 레이스(#624 후속)의 수정. 화면 감시 클리어는 두지 않는다.

  // Which house the 집 switcher is on — kept here because HouseScreen
  // unmounts while visiting a friend's room and must reopen on the same house.
  const [houseIndex, setHouseIndex] = useState(0);
  // Mini room previews for the current house's member tiles (#268).
  const { previews: memberRoomPreviews, load: loadRoomPreviews } = useMemberRoomPreviews();
  // 캐릭터 교체가 집 화면 내 타일에 즉시 반영되도록(#282), 캐시된 프리뷰 위에
  // 내 좌석의 캐릭터만 착용 캐릭터로 파생한다 (서버 재조회 없음).
  const roomPreviews = useMemo(
    () => withMyCharacter(memberRoomPreviews, houses, selectedCharacterId),
    [memberRoomPreviews, houses, selectedCharacterId],
  );
  const currentHouse = houses[houseIndex] ?? houses[0];
  useEffect(() => {
    if (screen !== 'house' || !currentHouse?.houseId) return;
    const membershipIds = currentHouse.floors
      .flatMap((f) => f.rooms.map((r) => r.membershipId))
      .filter((id): id is number => id != null);
    // catalogueReady=!shopLoading: an EMPTY pre-load catalogue must not fill
    // the per-house cache with blank rooms (the effect re-fires when it lands).
    void loadRoomPreviews(currentHouse.houseId, membershipIds, catalogue, !shopLoading);
  }, [screen, currentHouse, catalogue, shopLoading, loadRoomPreviews]);

  // 공동미션 ↔ 내 루틴 연동 (#272 → #578) — use-mission-links.ts로 이관 (#692 3단계).
  const {
    addMissionRoutine,
    houseCategoryIds,
    houseLinkedRoutines,
    contributedMissionIdList,
    deleteMissionWithLinked,
    leaveHouseWithLinked,
    toggleWithMissionGuard,
  } = useMissionLinks({
    houses,
    currentHouse,
    routines,
    completions,
    categories,
    myRoomLoading,
    housesLoading,
    contributedMissionIds,
    ensureCategory,
    addRoutineWithMission,
    linkCategoryHouse,
    linkRoutineMission,
    deleteRoutine,
    deleteCategoryCascade,
    toggleCompletion,
    leaveHouse,
    deleteMission,
    applyMissionContribution,
  });

  // Profile + settings. Nickname/bio seed from the API (/me) and persist via
  // PUT /me (saveProfile); local state keeps edits visible immediately.
  const [nickname, setNickname] = useState('준서');
  const [bio, setBio] = useState('');
  useEffect(() => {
    if (apiNickname) setNickname(apiNickname);
  }, [apiNickname]);
  useEffect(() => {
    if (apiBio != null) setBio(apiBio);
  }, [apiBio]);
  // 설정 서피스 (#692 2단계) — 설정 탭·서브화면 8종의 훅·콜백·JSX 소유.
  const handleProfileSave = useCallback(
    (nick: string, b: string) => {
      setNickname(nick);
      setBio(b);
      void saveProfile(nick, b);
    },
    [saveProfile],
  );
  const settingsSurface = useSettingsSurface({
    screen,
    setScreen,
    onReplayOnboarding,
    profile: { nickname, bio, characterId: wornCharacterId, onSave: handleProfileSave },
  });
  // 나의 방 페이지 배선 (#692 5단계) — 나의 방 탭 페이지와 서브화면 4종
  // (루틴 관리·추가·카테고리 관리·알림 목록)의 훅·콜백·JSX 소유.
  const myRoomPages = useMyRoomPages({
    nav: { screen, setScreen, addReturnScreen, setAddReturnScreen },
    data: myRoomData,
    nickname,
    missionLinks: { toggleWithMissionGuard, houseCategoryIds, addRoutineWithMission },
    character: { wornCharacterId, wornCharacterAnimations, ownedCharacters, wearCharacter },
    room: {
      placedFurnitureIds,
      placements: placement.freeLayout ? placedItems : null,
      wallpaperId,
      floorId,
      backgroundId,
      catalogue,
    },
  });
  // 홈 위젯 오늘 요약 동기화 (#604, 안드로이드 전용) — 완료 토글·루틴
  // 변경·스트릭 갱신이 위젯에 바로 반영되게 요약을 기록하고 재렌더를 민다.
  const widgetSummarySigRef = useRef('');
  useEffect(() => {
    // 홈 위젯이 있는 플랫폼만 (#604 안드, #606 iOS) — 웹은 제외.
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    const today = todayIso();
    const summary = buildWidgetSummary(
      routines.filter((r) => isScheduledOn(r, today)),
      completions,
      streak,
      today,
    );
    const sig = JSON.stringify(summary);
    if (sig === widgetSummarySigRef.current) return;
    widgetSummarySigRef.current = sig;
    void saveWidgetSummary(summary).then(refreshWidgets);
  }, [routines, completions, streak]);

  // 화면 전환 추적 (#437) — 셸의 screen 상태가 곧 내비게이션 단위.
  useEffect(() => {
    screenView(screen);
  }, [screen]);

  /** 미션 배너 탭·완료 시트 '하러 가기' — 해당 미션의 진입 화면으로 (#571). */
  const { addRoutineFromMyRoom } = myRoomPages;
  const openMissionScreen = useCallback(
    (id: OnboardingMissionStepId) => {
      if (id === 'register-routine') {
        // 루틴 추가 화면(추천 루틴 아코디언)으로 — 뒤로 가면 나의 방 복귀.
        // (편집 중 루틴 초기화 포함 — use-my-room-pages의 + 버튼 경로와 동일.)
        addRoutineFromMyRoom();
        return;
      }
      setScreen(MISSION_TARGET_SCREEN[id]);
    },
    [addRoutineFromMyRoom],
  );

  // --- memo 화면(HouseScreen)으로 가는 콜백/파생 prop (#539) ---
  // 인라인 화살표·렌더마다 새로 만드는 객체는 memo 경계를 무효화한다. 매 렌더
  // 마운트되지 않는 다른 화면들(RoomDecorScreen 등)은 인라인을 유지한다.
  const openHouseSearch = useCallback(() => {
    browsedHouseRef.current = false;
    setScreen('houseSearch');
  }, []);
  // 친구 방문 클러스터 (#149·#644) — use-friend-visit.tsx로 이관 (#692 4단계).
  const { visitFriend, subScreen: friendRoomSubScreen } = useFriendVisit({
    setScreen,
    catalogue,
    arrangedHouses,
    houseIndex,
    screen,
    cheerMember,
  });
  // 방장 관리 진입 시 구성원·입주 신청 목록 갱신 (#526).
  const openMemberManagement = useCallback(() => {
    void refreshHouses();
  }, [refreshHouses]);
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

  // Android hardware back navigates the shell's own screen stack; 루트(나의 방)
  // 에서는 바로 끄지 않고 더블 백으로 종료한다 (#522) — 첫 입력은 토스트
  // 안내, EXIT_WINDOW 안에 한 번 더 누르면 종료. (iOS는 시스템 종료
  // 뒤로가기가 없고 코드 종료도 금지라 해당 경로 자체가 없다.)
  // --- 하단 탭 수평 페이저 (#563) ---
  // 집 화면이 확대·자리 드래그로 제스처 전권을 가져간 동안 페이저를 잠근다.
  // 단 집 "페이지가 활성일 때만" — 확대를 남겨둔 채 탭 버튼으로 떠났을 때
  // 다른 페이지의 스와이프까지 막으면 안 된다.
  const pagerLock = useSharedValue(false);
  // 공유값을 ref로 감싸 콜백을 무의존으로 — 프로덕션의 useSharedValue는 참조가
  // 안정적이지만, 의존성에 직접 넣으면 memo 화면으로 가는 콜백의 안정성이
  // reanimated 구현 디테일에 묶인다(렌더 안정성 프로브 #539 계약).
  const pagerLockRef = useRef(pagerLock);
  pagerLockRef.current = pagerLock;
  const housePagerLockRef = useRef(false);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const handleHousePagerLock = useCallback((locked: boolean) => {
    housePagerLockRef.current = locked;
    pagerLockRef.current.value = locked && TAB_FOR_SCREEN[screenRef.current] === 'house';
  }, []);
  useEffect(() => {
    pagerLockRef.current.value = housePagerLockRef.current && activeTab === 'house';
  }, [activeTab]);

  return (
    <View style={styles.root}>
      {/* 엣지 백 (#564) — 콘텐츠 전체를 감싸되 관찰만 한다(차단 없음). */}
      <GestureDetector gesture={edgeBackPan}>
        <Animated.View
          style={[styles.content, { opacity: transOpacity, transform: [{ translateX: transX }] }]}>
          {/* 하단 탭 3서피스는 수평 페이저에 상주한다 (#563) — 스와이프 중
            이웃 화면이 손가락을 따라 끝까지 보인다. 비활성 페이지는 페이저가
            드래그/정착 중에만 그린다. 서브화면들은 기존처럼 단독 렌더. */}
          {activeTab ? (
            <TabPager
              index={NAV_ORDER.indexOf(activeTab)}
              onIndexChange={handlePageChange}
              lock={pagerLock}>
              <MyRoomScreen {...myRoomPages.tabProps} />
              <HouseScreen
                houses={arrangedHouses}
                pendingHouses={pendingHouseCards}
                onCancelJoinRequest={cancelJoinRequest}
                onSwapSeats={swapSeats}
                loading={housesLoading}
                loadError={housesError}
                onRetry={retryHouses}
                onRefresh={refreshHousePull}
                covers={houseCovers}
                characterId={wornCharacterId}
                userName={nickname}
                streakDays={streak}
                roomPreviews={roomPreviews}
                furniture={catalogue.furniture}
                wallpapers={catalogue.wallpapers}
                floors={catalogue.floors}
                backgrounds={catalogue.backgrounds}
                houseIndex={houseIndex}
                onHouseIndexChange={setHouseIndex}
                onVisitFriend={visitFriend}
                onVisitMyRoom={myRoomPages.openMyRoom}
                onOpenSearch={openHouseSearch}
                coinBalance={wallet.coin}
                diamondBalance={wallet.diamond}
                raining={raining}
                onOpenMemberManagement={openMemberManagement}
                onAcceptJoinRequest={handleAcceptJoinRequest}
                onRejectJoinRequest={handleRejectJoinRequest}
                onKickMember={handleKickMember}
                onLeaveHouse={handleLeaveHouse}
                linkedRoutines={houseLinkedRoutines}
                contributedMissionIds={contributedMissionIdList}
                onAddMissionRoutine={handleAddMissionRoutine}
                onClaimMission={handleClaimMission}
                onCreateMission={handleCreateMission}
                onDeleteMission={handleDeleteMission}
                onUpdateHouse={handleUpdateHouse}
                onTransferOwnership={handleTransferOwnership}
                onReissueInviteCode={handleReissueInviteCode}
                onPagerLockChange={handleHousePagerLock}
              />
              <SettingsScreen {...settingsSurface.tabProps} />
            </TabPager>
          ) : null}

          {screen === 'decor' ? (
            <RoomDecorScreen
              initialItems={placedItems}
              highlightItemIds={newDecorItemIds}
              freeLayout={placement.freeLayout}
              initialWallpaperId={wallpaperId}
              initialFloorId={floorId}
              initialBackgroundId={backgroundId}
              ownedIds={ownedIds}
              furniture={catalogue.furniture}
              wallpapers={catalogue.wallpapers}
              floors={catalogue.floors}
              backgrounds={catalogue.backgrounds}
              loading={shopLoading}
              loadError={shopError}
              onRetry={retryShop}
              coinBalance={wallet.coin}
              diamondBalance={wallet.diamond}
              characterId={wornCharacterId}
              characterAnimations={wornCharacterAnimations}
              // 일괄 구매(프리뷰 저장, #501)가 결과를 기다린다 — Promise를 그대로.
              onBuy={(itemId) => purchaseFurniture(itemId)}
              onApply={async (its, wp, fl, bg) => {
                const result = await saveLayout(its, wp, fl, bg);
                if (result === 'ok') {
                  setPlacedItems(its);
                  setPlacedFurnitureIds(its.map((p) => p.furnitureId));
                  setWallpaperId(wp);
                  setFloorId(fl);
                  setBackgroundId(bg);
                  // 꾸미기 저장 성공 = 미션 3 완료 (#571) — 새 아이템 포함
                  // 여부는 따지지 않는다(사양 단순화).
                  completeMission('place-furniture');
                }
                return result;
              }}
              onConflictReload={() => {
                void retryShop();
              }}
              onBack={() => setScreen('myRoom')}
            />
          ) : null}

          {/* 나의 방 서브화면 4종 (#692 5단계) — use-my-room-pages가 그린다. */}
          {myRoomPages.subScreen}

          {screen === 'gacha' ? (
            <GachaScreen
              gachas={gachas}
              loading={gachasLoading}
              loadError={gachasError}
              onRetry={retryGachas}
              coinBalance={wallet.coin}
              diamondBalance={wallet.diamond}
              onBack={() => setScreen('myRoom')}
              onDraw={async (gachaId, count) => {
                const results = await drawGachaMachine(gachaId, count);
                // Drawn items land in the inventory — re-sync so 방 꾸미기 shows
                // them as 보유중 and placement saves know their userItemId.
                if (results?.some((r) => r.itemId != null && !r.converted)) void refreshOwned();
                // A drawn character must show up in the 캐릭터 교체 picker too.
                if (results?.some((r) => r.characterId != null && !r.converted))
                  void reloadMyCharacters();
                return results;
              }}
              placeableItemIds={placeableFurnitureIds}
              // 보상 목록 (#620) — 시트가 자체 재시도를 가지므로 실패는 null로.
              onLoadRewards={(gachaId) => fetchGachaRewards(gachaId).catch(() => null)}
              onGoPlace={goPlaceDrawn}
              // 뽑기 성공 = 미션 2 완료 (#571) — 연출이 끝나고 확인을 누른
              // 순간에. 뽑기 직후 완료시키면 미션 시트가 연출을 덮는다.
              onResultsConfirmed={() => completeMission('first-draw')}
            />
          ) : null}

          {/* 친구 방 (#149) — use-friend-visit이 그린다 (#692 4단계). */}
          {friendRoomSubScreen}

          {screen === 'houseSearch' ? (
            <HouseSearchScreen
              initialCode={pendingJoinCode ?? undefined}
              onInitialCodeConsumed={() => setPendingJoinCode(null)}
              houses={searchHouses}
              loading={searchLoading}
              loadError={searchError}
              onRetry={retrySearch}
              onBack={() => {
                // 둘러보고 나가는 순간에 미션 4 완료 (#571 후속) — 탐색 중에
                // 완료 시트가 화면을 덮지 않게 한다.
                if (browsedHouseRef.current) completeMission('browse-house');
                setScreen(noHouses ? 'myRoom' : 'house');
              }}
              onJoinByCode={async (code) => {
                const ok = await joinByCode(code);
                if (ok === true) {
                  // 가입 성공 = 탐색의 성공적 종료 — 둘러보기 미션도 완료.
                  completeMission('browse-house');
                  setScreen('house');
                }
                return ok;
              }}
              onPreviewCode={async (code) => {
                const detail = await previewByCode(code);
                // 'network'는 실패 신호 — 열람 성공만 둘러봤음으로 친다.
                if (detail && detail !== 'network') browsedHouseRef.current = true;
                return detail;
              }}
              // 카탈로그를 얹어 미리보기 창문에 실제 방을 그린다 (#386).
              onPreviewHouse={async (houseId) => {
                const detail = await previewHouse(houseId, catalogue);
                // 미리보기 열람 = 둘러봤음 표시 — 완료는 나갈 때 (#571 후속).
                if (detail) browsedHouseRef.current = true;
                return detail;
              }}
              furniture={catalogue.furniture}
              wallpapers={catalogue.wallpapers}
              floors={catalogue.floors}
              backgrounds={catalogue.backgrounds}
              onJoinHouse={(houseId) => {
                void joinSearchHouse(houseId).then((ok) => {
                  if (!ok) return;
                  completeMission('browse-house');
                  setScreen('house');
                });
              }}
              onCreate={() => setScreen('createHouse')}
            />
          ) : null}

          {screen === 'createHouse' ? (
            <CreateHouseScreen
              covers={houseCovers}
              onBack={() => setScreen('houseSearch')}
              onCreate={(input) => {
                void createHouse(input).then((ok) => ok && setScreen('house'));
              }}
            />
          ) : null}

          {/* 설정 서브화면 8종 (#692) — use-settings-surface가 그린다. */}
          {settingsSurface.subScreen}
        </Animated.View>
      </GestureDetector>

      {activeTab ? (
        <BottomNav
          active={activeTab}
          onChange={(tab) =>
            // 집이 없으면 집 탭은 빈 상태 대신 집 탐색으로 직행 (#571).
            setScreen(tab === 'house' && noHouses ? 'houseSearch' : SCREEN_FOR_TAB[tab])
          }
        />
      ) : null}

      {/* 온보딩 미션 진행 배너 (#571) — 관련 화면 상단에만 얹는다. */}
      {missions.step && MISSION_BANNER_SCREENS.has(screen) ? (
        <MissionBanner
          stepIndex={missions.stepIndex}
          totalSteps={missions.totalSteps}
          label={missions.step.label}
          onPress={() => {
            const id = missions.step?.id;
            if (id) openMissionScreen(id);
          }}
          onSkip={missions.skip}
        />
      ) : null}

      {/* 미션 완료 전환 시트 (#571) — 다음 미션 안내 / 마지막 축하. */}
      <MissionSheet
        visible={missions.completedIndex != null}
        completedStep={(missions.completedIndex ?? 0) + 1}
        totalSteps={missions.totalSteps}
        nextLabel={missions.step?.label ?? null}
        nextHint={missions.step?.hint ?? null}
        onGo={() => {
          const id = missions.step?.id;
          missions.dismissCompleted();
          if (id) openMissionScreen(id);
        }}
        onClose={missions.dismissCompleted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
