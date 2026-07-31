import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Linking, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { TabPager } from '@/components/app/tab-pager';
import { CreateHouseScreen } from '@/components/screens/create-house-screen';
import { FriendRoomScreen } from '@/components/screens/friend-room-screen';
import { GachaScreen } from '@/components/screens/gacha-screen';
import {
  type HouseEditInput,
  HouseScreen,
  type NewHouseMission,
  type VisitedFriend,
} from '@/components/screens/house-screen';
import { HelpScreen } from '@/components/screens/help-screen';
import { InviteFriendsScreen } from '@/components/screens/invite-friends-screen';
import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { type CalendarDayItem, MyRoomScreen } from '@/components/screens/my-room-screen';
import { NotificationListScreen } from '@/components/screens/notification-list-screen';
import { NotificationSettingsScreen } from '@/components/screens/notification-settings-screen';
import { PasswordChangeScreen } from '@/components/screens/password-change-screen';
import { ProfileEditScreen } from '@/components/screens/profile-edit-screen';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { BugReportScreen } from '@/components/screens/bug-report-screen';
import { CategoryManageScreen } from '@/components/screens/category-manage-screen';
import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';
import { ThemeScreen } from '@/components/screens/theme-screen';
import {
  DEFAULT_SOUND_SETTINGS,
  type SoundSettings,
  SoundSettingsScreen,
} from '@/components/screens/sound-settings-screen';
import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { houseCoverKey } from '@/components/room/house-preview-frame';
import { MissionSheet } from '@/components/screens/sheets/mission-sheet';
import { BottomNav, type NavTab } from '@/components/ui/bottom-nav';
import { MissionBanner } from '@/components/ui/mission-banner';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { PolicyUrls, SUPPORT_EMAIL } from '@/constants/policy';
import { CATEGORY_COLORS, type Routine } from '@/constants/routines';
import { screenView, track } from '@/lib/analytics';
import { onNotificationTap } from '@/lib/push-events';
import { pickLibraryImage } from '@/lib/pick-image';
import { todayIso } from '@/utils/datetime';
import { setHapticsEnabled } from '@/utils/haptics';
import { useAuth } from '@/hooks/use-auth';
import { useGacha } from '@/hooks/use-gacha';
import {
  type OnboardingMissionStepId,
  useOnboardingMissions,
} from '@/hooks/use-onboarding-missions';
import { useFriendRoom } from '@/hooks/use-friend-room';
import { useGuestbook } from '@/hooks/use-guestbook';
import { useToast } from '@/components/ui/toast';
import { useHouseCovers } from '@/hooks/use-house-covers';
import { useHouses } from '@/hooks/use-houses';
import { useInvites } from '@/hooks/use-invites';
import { useMemberRoomPreviews, withMyCharacter } from '@/hooks/use-member-room-previews';
import { useRoomLayouts } from '@/hooks/use-room-layouts';
import { useMyCharacters } from '@/hooks/use-my-characters';
import { useMyRoomData } from '@/hooks/use-my-room-data';
import { useBugReports } from '@/hooks/use-bug-reports';
import { useNotificationSettings } from '@/hooks/use-notification-settings';
import { useNotifications } from '@/hooks/use-notifications';
import { useShop } from '@/hooks/use-shop';
import { useWeather } from '@/hooks/use-weather';
import { useBrandTheme } from '@/hooks/use-tokens';
import { assetSource } from '@/resources/asset';
import { DEFAULT_WALLPAPER_ID, type PlacedFurniture } from '@/resources/furniture';

type Screen =
  | 'myRoom'
  | 'decor'
  | 'routineManage'
  | 'addRoutine'
  | 'categoryManage'
  | 'gacha'
  | 'house'
  | 'friendRoom'
  | 'houseSearch'
  | 'createHouse'
  | 'settings'
  | 'theme'
  | 'profileEdit'
  | 'passwordChange'
  | 'notificationList'
  | 'bugReport'
  | 'notifications'
  | 'sound'
  | 'help'
  | 'inviteFriends';

/** Which bottom-nav tab is active for each screen, or null to hide the nav. */
const TAB_FOR_SCREEN: Record<Screen, NavTab | null> = {
  myRoom: 'myRoom',
  decor: null,
  routineManage: null,
  addRoutine: null,
  categoryManage: null,
  gacha: null,
  house: 'house',
  friendRoom: null,
  houseSearch: null,
  createHouse: null,
  settings: 'settings',
  theme: null,
  profileEdit: null,
  passwordChange: null,
  notificationList: null,
  bugReport: null,
  notifications: null,
  sound: null,
  help: null,
  inviteFriends: null,
};

const SCREEN_FOR_TAB: Record<NavTab, Screen> = {
  myRoom: 'myRoom',
  house: 'house',
  settings: 'settings',
};

/** 하단 탭의 페이지 순서 (#563) — 페이저 인덱스 ↔ 탭 매핑. */
const NAV_ORDER: NavTab[] = ['myRoom', 'house', 'settings'];

/**
 * Where the Android hardware back button lands from each screen. `null` on
 * myRoom = fall through to the OS default (exit the app). addRoutine is dynamic
 * (returns to wherever it was opened from) and handled separately.
 */
const BACK_SCREEN: Record<Screen, Screen | null> = {
  myRoom: null,
  decor: 'myRoom',
  routineManage: 'myRoom',
  addRoutine: 'routineManage',
  categoryManage: 'myRoom',
  gacha: 'myRoom',
  house: 'myRoom',
  friendRoom: 'house',
  houseSearch: 'house',
  createHouse: 'houseSearch',
  settings: 'myRoom',
  theme: 'settings',
  profileEdit: 'settings',
  passwordChange: 'settings',
  notificationList: 'myRoom',
  bugReport: 'settings',
  notifications: 'settings',
  sound: 'settings',
  help: 'settings',
  inviteFriends: 'settings',
};

/** 더블 백 종료 허용 창 (#522) — 토스트 표시와 체감이 맞는 2초. */
const EXIT_WINDOW_MS = 2000;

/** 사운드 설정의 기기 보관 키 (#405) — 알림 설정은 서버로 이관됨 (#495). */
const DEVICE_SETTINGS_KEY = 'rougether.device-settings';

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
  const {
    themeId,
    setThemeId,
    mode: themeMode,
    setMode: setThemeMode,
    fontId,
    setFontId,
  } = useBrandTheme();
  // 스토어 요건(#545): 도움말의 실제 앱 버전 표기.
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  // 집 하늘 연출용 현재 비 여부 (#360) — 서울 고정, 30분 캐시.
  const { raining } = useWeather();
  const [screen, setScreen] = useState<Screen>('myRoom');

  // 온보딩 미션 체인 (#571) — 온보딩 완주 직후 시작, 완료/스킵 플래그가
  // 있으면 시작하지 않는다. 단계 완료는 아래 액션 지점들이 complete로 쏜다.
  const missions = useOnboardingMissions(startMissions);
  const completeMission = missions.complete;

  // Routines / todos / categories / completion / wallet come from the API.
  const {
    routines,
    completions,
    categories,
    allCategories,
    calendarDays,
    loadCalendarDay,
    wallet,
    setWallet,
    nickname: apiNickname,
    bio: apiBio,
    streak,
    loading: myRoomLoading,
    error: myRoomError,
    retry: retryMyRoom,
    reload: reloadMyRoom,
    toggleCompletion,
    toggleCalendarItem,
    saveProfile,
    quickAddTodo,
    addRoutine,
    updateRoutine,
    renameRoutine,
    updateRoutineTime,
    updateTodoDueDate,
    moveRoutineOccurrence,
    deleteRoutine,
    createRoutineCategory,
    ensureCategory,
    linkRoutineMission,
    linkCategoryHouse,
    updateRoutineCategory,
    deleteRoutineCategory,
    deleteCategoryCascade,
    reorderCategories,
  } = useMyRoomData();

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

  const { logout, withdraw } = useAuth();

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
  const { show: toast } = useToast();
  // 외부 링크 — 핸들러 없는 기기(메일 앱 미설정 등)에서 reject되므로 토스트로 안내.
  const openExternal = useCallback(
    (url: string) => {
      Linking.openURL(url).catch(() =>
        toast('링크를 열 수 없어요. 잠시 후 다시 시도해 주세요.', 'error'),
      );
    },
    [toast],
  );
  const openSupportMail = useCallback(() => {
    openExternal(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[루게더] 문의')}`);
  }, [openExternal]);

  // 알림 (list + read receipts); loaded on mount so the header bell can show
  // the unread dot, refreshed each time the list opens.
  const {
    entries: notificationEntries,
    unreadCount,
    loading: notificationsLoading,
    hasNext: notificationsHasNext,
    error: notificationsError,
    load: loadNotifications,
    loadMore: loadMoreNotifications,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
  } = useNotifications();
  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // 버그 제보 (#496) — 화면을 열 때 내 제보 내역을 불러온다.
  const { entries: bugReports, load: loadBugReports, submit: submitBugReport } = useBugReports();

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
  // 인디케이터는 어차피 되돌아간다). 나의 방은 전체 리페치, 집은 목록 리로드.
  const refreshMyRoom = useCallback(async () => {
    try {
      await reloadMyRoom();
    } catch {
      // 유지 — 기존 데이터가 그대로 남는다.
    }
  }, [reloadMyRoom]);
  const refreshHousePull = useCallback(async () => {
    try {
      await refreshHouses();
    } catch {
      // 유지.
    }
  }, [refreshHouses]);

  // 친구 초대 리워드 (#518) — 설정 → 친구 초대 화면의 데이터·액션.
  const {
    info: inviteInfo,
    loading: invitesLoading,
    loadError: invitesLoadError,
    load: loadInvites,
    redeem: redeemInviteCode,
  } = useInvites();

  // Locally saved tile arrangements (#278) — the 집 화면 shows arranged houses
  // and drag-and-drop swaps persist per viewer+house on this device.
  const { houses: arrangedHouses, swapSeats } = useRoomLayouts(houses);

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

  const [visitingFriend, setVisitingFriend] = useState<VisitedFriend>({ name: '친구' });
  // Which house the 집 switcher is on — kept here because HouseScreen
  // unmounts while visiting a friend's room and must reopen on the same house.
  const [houseIndex, setHouseIndex] = useState(0);
  // The visited friend's live room + today's routines (loads on visit, #149).
  const { friendRoom, load: loadFriendRoom } = useFriendRoom();
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

  // --- 공동미션 ↔ 내 루틴 연동 (#272 → #578). 연동은 서버 링크 id가 진실:
  // 카테고리.houseId == 집 id, 루틴.linkedMissionId == 미션 id (이름 매칭 폐지).
  // (여기부터의 셸 헬퍼들은 memo 화면(MyRoomScreen·HouseScreen)의 prop으로
  // 흘러가므로 전부 useCallback/useMemo로 참조를 고정한다, #539.)

  /** 미션의 + → 집 연동 카테고리(없으면 생성) 아래 연동 매일 루틴 생성. */
  const addingMissionRef = useRef(false);
  const addMissionRoutineInner = useCallback(
    async (houseId: number, mission: { id: number; title: string }) => {
      const house = houses.find((h) => h.houseId === houseId);
      if (!house) return;
      // Server-fresh find-or-create — stale local state must not duplicate it.
      const category = await ensureCategory({
        id: '',
        name: house.name,
        icon: 'house',
        color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
        // 집 구성원과 공유하는 맥락이므로 이웃 공개(HOUSE).
        visibility: 'neighbor',
        houseId,
      });
      if (!category) return;
      await addRoutineWithMission({
        title: mission.title,
        category: category.id,
        repeat: 'daily',
        days: [],
        startDate: todayIso(),
        alarmEnabled: false,
        time: '',
        photoVerify: false,
        linkedMissionId: mission.id,
      });
    },
    [houses, categories.length, ensureCategory, addRoutineWithMission],
  );
  const addMissionRoutine = useCallback(
    async (houseId: number, mission: { id: number; title: string }) => {
      // A double-fired press must not create the category twice.
      if (addingMissionRef.current) return;
      addingMissionRef.current = true;
      try {
        await addMissionRoutineInner(houseId, mission);
      } finally {
        addingMissionRef.current = false;
      }
    },
    [addMissionRoutineInner],
  );

  // 집에 연동된(houseId 매칭) 카테고리들 — 나의 방 quick-add를 막는다.
  const houseCategoryIds = useMemo(
    () =>
      categories
        .filter((c) => c.houseId != null && houses.some((h) => h.houseId === c.houseId))
        .map((c) => c.id),
    [categories, houses],
  );

  // 현재 집 미션에 연동된 내 루틴 (미션 카드의 연동/기여함 라벨 판정 —
  // 오늘 완료 여부가 곧 '기여함'이라 앱 재시작 후에도 라벨이 유지된다).
  const houseLinkedRoutines = useMemo(() => {
    const missionIds = new Set((currentHouse?.missions ?? []).map((m) => m.id));
    const today = todayIso();
    return routines
      .filter(
        (r) =>
          r.kind === 'routine' && r.linkedMissionId != null && missionIds.has(r.linkedMissionId),
      )
      .map((r) => ({
        missionId: r.linkedMissionId!,
        completedToday: (completions[r.id] ?? []).includes(today),
      }));
  }, [currentHouse, routines, completions]);

  // HouseScreen은 배열 prop을 받는다 — Set에서 파생한 배열의 참조를 고정.
  const contributedMissionIdList = useMemo(
    () => [...contributedMissionIds],
    [contributedMissionIds],
  );

  /** 주어진 미션 id들에 연동된 내 루틴 (#578) — id 매칭만 쓴다. */
  const linkedRoutinesFor = useCallback(
    (missionIds: number[]) =>
      routines.filter(
        (r) =>
          r.kind === 'routine' &&
          r.linkedMissionId != null &&
          missionIds.includes(r.linkedMissionId),
      ),
    [routines],
  );

  /** 미션 삭제 성공 시 내 연동 루틴도 함께 삭제 — 고아 연동물 방지 (#338). */
  const deleteMissionWithLinked = useCallback(
    async (houseId: number, missionId: number) => {
      const linked = linkedRoutinesFor([missionId]);
      if (!(await deleteMission(houseId, missionId))) return;
      for (const r of linked) await deleteRoutine(r.id);
      if (linked.length > 0) toast('연동된 루틴도 함께 삭제했어요');
    },
    [linkedRoutinesFor, deleteMission, deleteRoutine, toast],
  );

  /** 집 나가기/삭제 성공 시 연동 카테고리를 루틴째 통삭제 (#338). */
  const leaveHouseWithLinked = useCallback(
    async (houseId: number) => {
      const cat = categories.find((c) => c.houseId === houseId);
      if (!(await leaveHouse(houseId))) return;
      if (!cat) return;
      await deleteCategoryCascade(cat.id);
      toast('연동된 카테고리와 루틴도 함께 삭제했어요');
    },
    [categories, leaveHouse, deleteCategoryCascade, toast],
  );

  // 이름 매칭 연동분 1회성 승격 (#578) — 서버 백필이 없어, 이름이 일치하는데
  // 링크 id가 없는 카테고리·루틴에 id를 심는다. 조건 기반(대상 없으면 no-op)
  // 이라 기기 플래그가 필요 없고, 실패분은 다음 부팅에 다시 잡힌다.
  const promotedRef = useRef(false);
  useEffect(() => {
    if (promotedRef.current || myRoomLoading || housesLoading) return;
    if (houses.length === 0) return;
    promotedRef.current = true;
    void (async () => {
      for (const house of houses) {
        if (house.houseId == null) continue;
        let cat = categories.find((c) => c.houseId === house.houseId);
        const nameMatched = categories.find((c) => c.name === house.name);
        if (!cat && nameMatched && nameMatched.houseId == null) {
          await linkCategoryHouse(nameMatched.id, house.houseId);
          cat = nameMatched;
        }
        if (!cat) continue;
        const catId = cat.id;
        for (const mission of house.missions ?? []) {
          if (mission.status !== 'ACTIVE') continue;
          const routine = routines.find(
            (r) =>
              r.kind === 'routine' &&
              r.linkedMissionId == null &&
              r.category === catId &&
              r.title === mission.title,
          );
          if (routine) await linkRoutineMission(routine.id, mission.id);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRoomLoading, housesLoading, houses, routines, categories]);

  // 미션이 사라진 연동 루틴 자동 정리 (#338) — 방장이 미션을 지웠거나 과거
  // 삭제분이 남아 미션 목록과 어긋난 경우, 데이터가 다 실린 뒤 한 번 맞춘다.
  // 링크 id 기준: 연동 카테고리의 집 미션 목록에 없는 linkedMissionId만 고아로
  // 본다. 미션 목록이 비면(조회 실패와 구분 불가) 건드리지 않는다.
  const sweptRef = useRef(false);
  useEffect(() => {
    if (sweptRef.current || myRoomLoading || housesLoading) return;
    if (houses.length === 0 || routines.length === 0) return;
    sweptRef.current = true;
    const orphans = routines.filter((r) => {
      if (r.kind !== 'routine' || r.linkedMissionId == null) return false;
      const cat = r.category ? categories.find((c) => c.id === r.category) : undefined;
      const house =
        cat?.houseId != null ? houses.find((h) => h.houseId === cat.houseId) : undefined;
      const missions = house?.missions ?? [];
      if (missions.length === 0) return false;
      return !missions.some((m) => m.id === r.linkedMissionId);
    });
    if (orphans.length === 0) return;
    void (async () => {
      for (const r of orphans) await deleteRoutine(r.id);
      toast('사라진 미션의 연동 루틴을 정리했어요');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRoomLoading, housesLoading, houses, routines, categories]);

  /**
   * 연동 루틴의 완료 취소를 막고(미션 기여는 회수되지 않는다), 완료 응답에
   * 실려온 서버 자동 기여 결과를 집 상태에 반영한다 (#578) — 클라가 따로
   * contribute를 쏘지 않는다(이중 기여는 서버가 스킵하지만 왕복 낭비).
   */
  const toggleWithMissionGuard = useCallback(
    async (id: string, date: string) => {
      const item = routines.find((r) => r.id === id);
      const done = (completions[id] ?? []).includes(date);
      if (item && done && item.linkedMissionId != null) {
        const linked = houses.some((h) =>
          (h.missions ?? []).some((m) => m.status === 'ACTIVE' && m.id === item.linkedMissionId),
        );
        if (linked) {
          toast('미션에 기여된 루틴은 완료를 취소할 수 없어요', 'error');
          return null;
        }
      }
      const result = await toggleCompletion(id, date);
      if (result?.houseMissionContribution) applyMissionContribution(result.houseMissionContribution); // prettier-ignore
      return result;
    },
    [routines, completions, houses, toast, toggleCompletion, applyMissionContribution],
  );
  // Guestbook for the friend room being visited (loads on visit).
  const {
    entries: guestbookEntries,
    loading: guestbookLoading,
    hasNext: guestbookHasNext,
    load: loadGuestbook,
    loadMore: loadMoreGuestbook,
    write: writeGuestbook,
  } = useGuestbook();
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);

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
  // 알림 설정은 서버 보관으로 이관 (#495) — 열 때 GET, 토글마다 낙관적 PATCH.
  const {
    settings: notificationSettings,
    loadError: notificationSettingsLoadError,
    load: loadNotificationSettings,
    toggle: toggleNotificationSetting,
  } = useNotificationSettings((message) => toast(message, 'error'));
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS);

  // 사운드 설정은 서버 API가 생기기 전까지 기기(AsyncStorage)에 보관 (#405).
  // 예전 저장값의 notifications 필드는 서버 이관(#495) 후 무시된다.
  useEffect(() => {
    void AsyncStorage.getItem(DEVICE_SETTINGS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as { sound?: SoundSettings };
        if (saved.sound) setSoundSettings((p) => ({ ...p, ...saved.sound }));
      } catch {
        // 손상된 저장값은 기본값으로 무시.
      }
    });
  }, []);
  const persistDeviceSettings = (sound: SoundSettings) => {
    void AsyncStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify({ sound })).catch(() => {});
  };
  // '햅틱 진동' 토글을 전역 게이트에 주입 (#586) — 이 이펙트가 없으면 토글이
  // 저장만 되고 아무것도 제어하지 않는다(휠 틱·완료 햅틱 등 전부 무조건 발사).
  useEffect(() => {
    setHapticsEnabled(soundSettings.haptics);
  }, [soundSettings.haptics]);

  // 푸시 탭(콜드 스타트 포함) → 알림 목록으로 (#405).
  useEffect(
    () =>
      onNotificationTap(() => {
        track('push_open');
        void loadNotifications();
        setScreen('notificationList');
      }),
    [loadNotifications],
  );

  // 화면 전환 추적 (#437) — 셸의 screen 상태가 곧 내비게이션 단위.
  useEffect(() => {
    screenView(screen);
  }, [screen]);

  // Remember where the add/edit-routine screen was opened from, so its back
  // button returns to the right place (my-room or routine manage).
  const [addReturnScreen, setAddReturnScreen] = useState<Screen>('routineManage');
  const openEditRoutine = useCallback((routine: Routine, from: Screen) => {
    setEditingRoutine(routine);
    setAddReturnScreen(from);
    setScreen('addRoutine');
  }, []);

  /** 미션 배너 탭·완료 시트 '하러 가기' — 해당 미션의 진입 화면으로 (#571). */
  const openMissionScreen = useCallback((id: OnboardingMissionStepId) => {
    if (id === 'register-routine') {
      // 루틴 추가 화면(추천 루틴 아코디언)으로 — 뒤로 가면 나의 방 복귀.
      setEditingRoutine(null);
      setAddReturnScreen('myRoom');
    }
    setScreen(MISSION_TARGET_SCREEN[id]);
  }, []);

  // --- memo 화면(MyRoomScreen·HouseScreen)으로 가는 콜백/파생 prop (#539) ---
  // 인라인 화살표·렌더마다 새로 만드는 객체는 memo 경계를 무효화한다. 매 렌더
  // 마운트되지 않는 다른 화면들(RoomDecorScreen 등)은 인라인을 유지한다.
  const openDecor = useCallback(() => setScreen('decor'), []);
  const openRoutineManage = useCallback(() => setScreen('routineManage'), []);
  const openCategoryManage = useCallback(() => setScreen('categoryManage'), []);
  const openGacha = useCallback(() => setScreen('gacha'), []);
  const openMyRoom = useCallback(() => setScreen('myRoom'), []);
  // 집 탐색 미션(#571 후속)은 "둘러보고 나갈 때" 완료 — 미리보기 성공 시
  // 표시만 해두고, 탐색 화면을 떠나는 순간(뒤로/가입) 완료 시트를 띄운다.
  // 탐색 중에 시트가 화면을 덮지 않게 하기 위함.
  const browsedHouseRef = useRef(false);
  const openHouseSearch = useCallback(() => {
    browsedHouseRef.current = false;
    setScreen('houseSearch');
  }, []);
  const openNotificationList = useCallback(() => {
    void loadNotifications();
    setScreen('notificationList');
  }, [loadNotifications]);
  // + 버튼은 바로 추가 화면으로 — 뒤로 가면 나의 방으로 복귀 (#335).
  const addRoutineFromMyRoom = useCallback(() => {
    setEditingRoutine(null);
    setAddReturnScreen('myRoom');
    setScreen('addRoutine');
  }, []);
  const editRoutineFromMyRoom = useCallback(
    (r: Routine) => openEditRoutine(r, 'myRoom'),
    [openEditRoutine],
  );
  const handleSelectDate = useCallback(
    (date: string) => {
      void loadCalendarDay(date);
    },
    [loadCalendarDay],
  );
  const handleToggleCalendarItem = useCallback(
    (item: CalendarDayItem, date: string) => {
      void toggleCalendarItem(item, date);
    },
    [toggleCalendarItem],
  );
  const wearCharacter = useCallback(
    (serverId: number) => {
      void selectWornCharacter(serverId);
    },
    [selectWornCharacter],
  );
  // 지난·완료 할 일 등 안 보이는 항목까지 포함한 카테고리별 점유 수 (#505).
  const categoryInUseCounts = useMemo(
    () =>
      routines.reduce<Record<string, { routines: number; todos: number }>>((acc, r) => {
        if (!r.category) return acc;
        const c = (acc[r.category] ??= { routines: 0, todos: 0 });
        if (r.kind === 'todo') c.todos += 1;
        else c.routines += 1;
        return acc;
      }, {}),
    [routines],
  );
  const visitFriend = useCallback(
    (friend: VisitedFriend) => {
      track('friend_room_visit');
      setVisitingFriend(friend);
      void loadGuestbook(friend.userId, friend.houseId);
      void loadFriendRoom(friend.houseId, friend.membershipId, catalogue);
      setScreen('friendRoom');
    },
    [loadGuestbook, loadFriendRoom, catalogue],
  );
  // 방문 실패 시 다시 시도 (#549) — 같은 친구의 방·방명록을 다시 불러온다.
  const retryFriendRoomVisit = useCallback(() => {
    void loadGuestbook(visitingFriend.userId, visitingFriend.houseId);
    void loadFriendRoom(visitingFriend.houseId, visitingFriend.membershipId, catalogue);
  }, [loadGuestbook, loadFriendRoom, visitingFriend, catalogue]);
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
    (houseId: number) => {
      void reissueInviteCode(houseId);
    },
    [reissueInviteCode],
  );

  // Android hardware back navigates the shell's own screen stack; 루트(나의 방)
  // 에서는 바로 끄지 않고 더블 백으로 종료한다 (#522) — 첫 입력은 토스트
  // 안내, EXIT_WINDOW 안에 한 번 더 누르면 종료. (iOS는 시스템 종료
  // 뒤로가기가 없고 코드 종료도 금지라 해당 경로 자체가 없다.)
  const lastBackRef = useRef(0);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const target =
        screen === 'addRoutine'
          ? addReturnScreen
          : screen === 'houseSearch' && noHouses
            ? // 집 없는 유저의 탐색 직행 (#571) — 빈 집 화면으로 되돌리지 않는다.
              'myRoom'
            : BACK_SCREEN[screen];
      if (!target) {
        const now = Date.now();
        if (now - lastBackRef.current <= EXIT_WINDOW_MS) {
          BackHandler.exitApp();
          return true;
        }
        lastBackRef.current = now;
        toast('한 번 더 뒤로가면 앱이 꺼져요');
        return true;
      }
      // 하드웨어 백으로 탐색을 떠나는 경로도 화면의 뒤로 버튼과 같은 규칙 —
      // 둘러봤다면 미션 4 완료 (#571 후속).
      if (screen === 'houseSearch' && browsedHouseRef.current) completeMission('browse-house');
      setScreen(target);
      return true;
    });
    return () => sub.remove();
  }, [screen, addReturnScreen, noHouses, toast, completeMission]);

  const activeTab = TAB_FOR_SCREEN[screen];

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

  // 페이저 스와이프 정착 → 탭 전환. 집이 없으면 집 페이지 대신 집 탐색으로
  // 직행 — 하단 탭 버튼(#571)과 같은 규칙.
  const handlePageChange = useCallback(
    (idx: number) => {
      const tab = NAV_ORDER[idx];
      if (!tab) return;
      setScreen(tab === 'house' && noHouses ? 'houseSearch' : SCREEN_FOR_TAB[tab]);
    },
    [noHouses],
  );

  // 설정 화면 콜백 — SettingsScreen이 memo라(탭 페이저로 상주, #539 후속)
  // 인라인 람다면 셸 리렌더마다 memo가 뚫린다. 전부 참조 고정.
  const openTheme = useCallback(() => setScreen('theme'), []);
  const openProfileEdit = useCallback(() => setScreen('profileEdit'), []);
  const openPasswordChange = useCallback(() => setScreen('passwordChange'), []);
  const openNotificationSettings = useCallback(() => {
    setScreen('notifications');
    // 화면을 열 때마다 서버값으로 최신화 (실패 시 기본값/직전값 유지).
    void loadNotificationSettings();
  }, [loadNotificationSettings]);
  const openSound = useCallback(() => setScreen('sound'), []);
  const openHelp = useCallback(() => setScreen('help'), []);
  // 친구 초대 (#518) — 진입 시점에 내 코드를 로드(없으면 서버가 발급).
  const openInviteFriends = useCallback(() => {
    setScreen('inviteFriends');
    void loadInvites();
  }, [loadInvites]);
  const openTerms = useCallback(() => openExternal(PolicyUrls.terms), [openExternal]);
  const openPrivacy = useCallback(() => openExternal(PolicyUrls.privacy), [openExternal]);
  const openBugReport = useCallback(() => {
    setScreen('bugReport');
    void loadBugReports();
  }, [loadBugReports]);
  const handleLogout = useCallback(() => {
    // Clearing the session flips auth status → AppRoot redirects to /login.
    void logout();
  }, [logout]);
  const handleWithdraw = useCallback(() => {
    // 성공 시 status가 guest로 바뀌어 AppRoot가 로그인으로 보낸다 (#547).
    void withdraw().then((ok) => {
      if (ok) toast('탈퇴가 완료됐어요');
      else toast('탈퇴에 실패했어요. 잠시 후 다시 시도해 주세요', 'error');
    });
  }, [withdraw, toast]);

  // 화면 전환 손맛 (#446) — 들어오는 화면이 이동 방향에서 밀려 들어온다.
  // 진입(서브화면)은 우측에서, 복귀(뒤로)는 좌측에서. 탭 간 전환은 이제
  // 페이저(#563)가 손가락 추종/슬라이드로 직접 그리므로 여기선 건너뛴다.
  const transOpacity = useRef(new Animated.Value(1)).current;
  const transX = useRef(new Animated.Value(0)).current;
  const prevScreenRef = useRef<Screen>(screen);
  useEffect(() => {
    const prev = prevScreenRef.current;
    if (prev === screen) return;
    prevScreenRef.current = screen;
    const prevTab = TAB_FOR_SCREEN[prev];
    const nextTab = TAB_FOR_SCREEN[screen];
    if (prevTab != null && nextTab != null) return; // 탭 간 — 페이저가 그린다.
    let slide = 28; // 기본: 서브화면 진입(우측에서)
    if (
      BACK_SCREEN[prev] === screen ||
      (prev === 'addRoutine' && screen === addReturnScreen) ||
      nextTab != null
    ) {
      // 뒤로 복귀(백맵 목적지·서브→탭) — 좌측에서 되돌아온다.
      slide = -28;
    }
    // 페이드가 짧으면 깜빡임으로 읽힌다 — 서브화면은 바닥 0.08에서 넉넉히.
    transOpacity.setValue(0.08);
    transX.setValue(slide);
    Animated.parallel([
      Animated.timing(transOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(transX, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [screen, addReturnScreen, transOpacity, transX]);

  return (
    <View style={styles.root}>
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
            <MyRoomScreen
              userName={nickname}
              streakDays={streak}
              coinBalance={wallet.coin}
              diamondBalance={wallet.diamond}
              routines={routines}
              completions={completions}
              categories={categories}
              allCategories={allCategories}
              calendarDays={calendarDays}
              onSelectDate={handleSelectDate}
              onToggleCalendarItem={handleToggleCalendarItem}
              loading={myRoomLoading}
              loadError={!!myRoomError}
              onRetry={retryMyRoom}
              placedFurnitureIds={placedFurnitureIds}
              placements={placement.freeLayout ? placedItems : null}
              wallpaperId={wallpaperId}
              floorId={floorId}
              backgroundId={backgroundId}
              furniture={catalogue.furniture}
              wallpapers={catalogue.wallpapers}
              floors={catalogue.floors}
              backgrounds={catalogue.backgrounds}
              characterId={wornCharacterId}
              characterAnimations={wornCharacterAnimations}
              onToggleCompletion={toggleWithMissionGuard}
              onEdit={openDecor}
              onAddRoutine={addRoutineFromMyRoom}
              onManageRoutines={openRoutineManage}
              onOpenNotifications={openNotificationList}
              unreadNotificationCount={unreadCount}
              ownedCharacters={ownedCharacters}
              onSelectCharacter={wearCharacter}
              onManageCategories={openCategoryManage}
              onUpdateCategory={updateRoutineCategory}
              onOpenGacha={openGacha}
              onRefresh={refreshMyRoom}
              onQuickAddRoutine={quickAddTodo}
              quickAddDisabledCategoryIds={houseCategoryIds}
              onRenameRoutine={renameRoutine}
              onEditRoutine={editRoutineFromMyRoom}
              onUpdateRoutineTime={updateRoutineTime}
              onUpdateTodoDueDate={updateTodoDueDate}
              onMoveRoutineOccurrence={moveRoutineOccurrence}
              onDeleteRoutine={deleteRoutine}
            />
            <HouseScreen
              houses={arrangedHouses}
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
              onVisitMyRoom={openMyRoom}
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
            <SettingsScreen
              themeMode={themeMode}
              onChangeThemeMode={setThemeMode}
              fontId={fontId}
              onChangeFont={setFontId}
              onOpenTheme={openTheme}
              onEditProfile={openProfileEdit}
              onChangePassword={openPasswordChange}
              onOpenNotifications={openNotificationSettings}
              onOpenSound={openSound}
              onOpenHelp={openHelp}
              onInviteFriends={openInviteFriends}
              onOpenTerms={openTerms}
              onOpenPrivacy={openPrivacy}
              onReportBug={openBugReport}
              onReplayOnboarding={onReplayOnboarding}
              onLogout={handleLogout}
              onWithdraw={handleWithdraw}
            />
          </TabPager>
        ) : null}

        {screen === 'decor' ? (
          <RoomDecorScreen
            initialItems={placedItems}
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

        {screen === 'routineManage' ? (
          <RoutineManageScreen
            routines={routines}
            categories={categories}
            loading={myRoomLoading}
            loadError={!!myRoomError}
            onRetry={retryMyRoom}
            onBack={() => setScreen('myRoom')}
            onAdd={() => {
              setEditingRoutine(null);
              setAddReturnScreen('routineManage');
              setScreen('addRoutine');
            }}
            onEdit={(r) => openEditRoutine(r, 'routineManage')}
          />
        ) : null}

        {screen === 'addRoutine' ? (
          <AddRoutineScreen
            categories={categories}
            editRoutine={editingRoutine}
            onAdd={addRoutineWithMission}
            onUpdate={updateRoutine}
            onDelete={deleteRoutine}
            onCreateCategory={createRoutineCategory}
            onBack={() => setScreen(addReturnScreen)}
          />
        ) : null}

        {screen === 'categoryManage' ? (
          <CategoryManageScreen
            categories={categories}
            inUseCounts={categoryInUseCounts}
            onCreate={createRoutineCategory}
            onUpdate={updateRoutineCategory}
            onDelete={deleteRoutineCategory}
            onReorder={(orderedIds) => {
              void reorderCategories(orderedIds);
            }}
            onBack={() => setScreen('myRoom')}
          />
        ) : null}

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
            // 뽑기 성공 = 미션 2 완료 (#571) — 연출이 끝나고 확인을 누른
            // 순간에. 뽑기 직후 완료시키면 미션 시트가 연출을 덮는다.
            onResultsConfirmed={() => completeMission('first-draw')}
          />
        ) : null}

        {screen === 'friendRoom' ? (
          <FriendRoomScreen
            friendName={visitingFriend.name}
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
            placedFurnitureIds={friendRoom.placement?.placedFurnitureIds ?? []}
            placements={friendRoom.placement?.placements ?? null}
            wallpaperId={friendRoom.placement?.wallpaperId}
            floorId={friendRoom.placement?.floorId ?? null}
            backgroundId={friendRoom.placement?.backgroundId ?? null}
            furniture={catalogue.furniture}
            wallpapers={catalogue.wallpapers}
            floors={catalogue.floors}
            backgrounds={catalogue.backgrounds}
            characterId={friendRoom.characterId}
            characterAnimations={friendRoom.characterAnimations}
            streakDays={friendRoom.streakDays}
            routines={friendRoom.routines}
            categories={friendRoom.categories}
            recentActivity={friendRoom.recentActivity}
            loading={friendRoom.loading}
            loadError={friendRoom.error}
            onRetry={retryFriendRoomVisit}
            onBack={() => setScreen('house')}
          />
        ) : null}

        {screen === 'houseSearch' ? (
          <HouseSearchScreen
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

        {screen === 'theme' ? (
          <ThemeScreen
            themeId={themeId}
            onChangeThemeId={setThemeId}
            onBack={() => setScreen('settings')}
          />
        ) : null}

        {screen === 'profileEdit' ? (
          <ProfileEditScreen
            initialNickname={nickname}
            initialBio={bio}
            characterId={wornCharacterId}
            onSave={(nick, b) => {
              setNickname(nick);
              setBio(b);
              void saveProfile(nick, b);
              setScreen('settings');
            }}
            onBack={() => setScreen('settings')}
          />
        ) : null}

        {screen === 'notificationList' ? (
          <NotificationListScreen
            notifications={notificationEntries}
            loading={notificationsLoading}
            loadError={notificationsError}
            onRetry={loadNotifications}
            hasNext={notificationsHasNext}
            onBack={() => setScreen('myRoom')}
            onRead={(id) => {
              void markNotificationRead(id);
            }}
            onReadAll={() => {
              void markAllNotificationsRead();
            }}
            onLoadMore={() => {
              void loadMoreNotifications();
            }}
          />
        ) : null}

        {screen === 'passwordChange' ? (
          <PasswordChangeScreen
            onSubmit={() => setScreen('settings')}
            onBack={() => setScreen('settings')}
          />
        ) : null}

        {screen === 'notifications' ? (
          <NotificationSettingsScreen
            settings={notificationSettings}
            onToggle={toggleNotificationSetting}
            loadError={notificationSettingsLoadError}
            onRetry={loadNotificationSettings}
            onBack={() => setScreen('settings')}
          />
        ) : null}

        {screen === 'sound' ? (
          <SoundSettingsScreen
            initialSettings={soundSettings}
            onChange={(next) => {
              setSoundSettings(next);
              persistDeviceSettings(next);
            }}
            onBack={() => setScreen('settings')}
          />
        ) : null}

        {screen === 'bugReport' ? (
          <BugReportScreen
            entries={bugReports}
            onSubmit={submitBugReport}
            onPickImage={pickLibraryImage}
            onBack={() => setScreen('settings')}
          />
        ) : null}

        {screen === 'help' ? (
          <HelpScreen
            onBack={() => setScreen('settings')}
            appVersion={appVersion}
            onContact={openSupportMail}
          />
        ) : null}

        {screen === 'inviteFriends' ? (
          <InviteFriendsScreen
            info={inviteInfo}
            loading={invitesLoading}
            loadError={invitesLoadError}
            onRetry={loadInvites}
            onRedeem={redeemInviteCode}
            onBack={() => setScreen('settings')}
          />
        ) : null}
      </Animated.View>

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
