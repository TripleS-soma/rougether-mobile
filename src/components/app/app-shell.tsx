import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Linking, StyleSheet, View } from 'react-native';

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
import { BottomNav, type NavTab } from '@/components/ui/bottom-nav';
import {
  CoachMarkOverlay,
  type CoachStep,
  CoachTargetProvider,
  useCoachTargets,
} from '@/components/ui/coach-mark';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { PolicyUrls, SUPPORT_EMAIL } from '@/constants/policy';
import { CATEGORY_COLORS, type Routine } from '@/constants/routines';
import { screenView, track } from '@/lib/analytics';
import { onNotificationTap } from '@/lib/push-events';
import { pickLibraryImage } from '@/lib/pick-image';
import { todayIso } from '@/utils/datetime';
import { useAuth } from '@/hooks/use-auth';
import { useGacha } from '@/hooks/use-gacha';
import { useFriendRoom } from '@/hooks/use-friend-room';
import { useGuestbook } from '@/hooks/use-guestbook';
import { useToast } from '@/components/ui/toast';
import { useHouseCovers } from '@/hooks/use-house-covers';
import { useHouses } from '@/hooks/use-houses';
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
  | 'help';

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
};

const SCREEN_FOR_TAB: Record<NavTab, Screen> = {
  myRoom: 'myRoom',
  house: 'house',
  settings: 'settings',
};

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
};

/** 더블 백 종료 허용 창 (#522) — 토스트 표시와 체감이 맞는 2초. */
const EXIT_WINDOW_MS = 2000;

/** 사운드 설정의 기기 보관 키 (#405) — 알림 설정은 서버로 이관됨 (#495). */
const DEVICE_SETTINGS_KEY = 'rougether.device-settings';

export type AppShellProps = {
  /** Character chosen at onboarding; defaults to the sample character. */
  characterId?: CharacterId;
  /** Re-run the onboarding (설정 → 튜토리얼 다시 보기 → 온보딩 → 코치마크). */
  onReplayOnboarding?: () => void;
  /** 온보딩을 방금 마쳤음 — 마운트 시 코치마크 튜토리얼을 시작한다 (#351). */
  startTutorial?: boolean;
};

/** 코치마크 단계 (#351) — 전 탭 순회. screen은 그 단계에서 보여야 할 화면. */
const TUTORIAL_STEPS: (CoachStep & { screen: Screen })[] = [
  {
    screen: 'myRoom',
    target: 'room-routines',
    title: '오늘의 루틴',
    body: '곰 발바닥을 누르면 루틴 완료! 완료하면 코인이 쌓여요.',
  },
  {
    screen: 'myRoom',
    target: 'room-add-routine',
    title: '루틴 추가',
    body: '+ 버튼으로 새 루틴을 바로 만들 수 있어요.',
  },
  {
    screen: 'myRoom',
    target: 'room-tab-calendar',
    title: '달력',
    body: '날짜별 루틴·할 일을 보고, 지난 날짜도 완료 체크할 수 있어요.',
  },
  {
    screen: 'myRoom',
    target: 'room-menu',
    title: '메뉴',
    body: '방 꾸미기, 캐릭터 교체, 루틴 관리가 여기에 모여 있어요.',
  },
  {
    screen: 'myRoom',
    target: 'room-gacha',
    title: '뽑기 상점',
    body: '모은 코인으로 가구와 캐릭터를 뽑아 방을 꾸며보세요.',
  },
  {
    screen: 'house',
    target: 'house-frame',
    title: '우리 집',
    body: '창문 속이 친구들의 방이에요. 탭하면 방문하고, 두 번 탭하면 확대돼요.',
  },
  {
    screen: 'house',
    target: 'house-missions',
    title: '공동 미션',
    body: '집 친구들과 함께 미션을 수행하면 집이 성장해요.',
  },
  {
    screen: 'house',
    target: 'house-search',
    title: '집 탐색',
    body: '새로운 집을 찾아 입주하거나 초대코드로 들어갈 수 있어요.',
  },
  {
    screen: 'house',
    target: 'nav-settings',
    title: '설정',
    body: '테마·알림 설정과 튜토리얼 다시 보기는 여기에 있어요. 이제 시작해볼까요?',
  },
];

/**
 * The app shell that wires every non-auth screen together with shared state:
 * 나의 방 / 집 / 설정 tabs plus the pushed sub-screens (decor, routine manage/add,
 * gacha, friend room, house search/create). Mirrors the prototype App.tsx
 * navigation, minus the auth flow.
 */
export function AppShell({
  characterId = DEFAULT_CHARACTER_ID,
  onReplayOnboarding,
  startTutorial = false,
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

  // 코치마크 튜토리얼 (#351) — 온보딩 직후 시작, 단계마다 해당 화면으로 전환.
  const [tutorialIdx, setTutorialIdx] = useState<number | null>(startTutorial ? 0 : null);
  const [shellFrame, setShellFrame] = useState({ w: 0, h: 0 });
  const shellRef = useRef<View>(null);
  const shellOrigin = useRef({ x: 0, y: 0 });
  const advanceTutorial = () => {
    if (tutorialIdx == null) return;
    const next = tutorialIdx + 1;
    if (next >= TUTORIAL_STEPS.length) {
      setTutorialIdx(null);
      return;
    }
    setScreen(TUTORIAL_STEPS[next].screen);
    setTutorialIdx(next);
  };

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
    updateRoutineCategory,
    deleteRoutineCategory,
    deleteCategoryCascade,
    reorderCategories,
  } = useMyRoomData();

  // Gacha machines + draw (spend + dupe→diamond handled server-side; wallet synced
  // from the draw response).
  const {
    gachas,
    loading: gachasLoading,
    error: gachasError,
    retry: retryGachas,
    draw: drawGachaMachine,
  } = useGacha(setWallet);

  const { logout } = useAuth();

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
    contributeMission,
    claimMission,
    createMission,
    deleteMission,
    updateHouse,
    transferOwnership,
    reissueInviteCode,
  } = useHouses();

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

  // --- 공동미션 ↔ 내 루틴 연동 (#272). Link convention: 카테고리명 == 집 이름,
  // 루틴명 == 미션명 — the server has no link field, so names carry it.
  // (여기부터의 셸 헬퍼들은 memo 화면(MyRoomScreen·HouseScreen)의 prop으로
  // 흘러가므로 전부 useCallback/useMemo로 참조를 고정한다, #539.)
  const contributeLinkedMission = useCallback(
    (item: Routine) => {
      const categoryName = categories.find((c) => c.id === item.category)?.name;
      if (!categoryName) return;
      const house = houses.find((h) => h.name === categoryName);
      const mission = house?.missions?.find((m) => m.status === 'ACTIVE' && m.title === item.title);
      if (house?.houseId && mission && !contributedMissionIds.has(mission.id))
        void contributeMission(house.houseId, mission.id);
    },
    [categories, houses, contributedMissionIds, contributeMission],
  );

  /** 미션의 + → 집 이름 카테고리(없으면 생성) 아래 매일 루틴 생성. */
  const addingMissionRef = useRef(false);
  const addMissionRoutineInner = useCallback(
    async (houseId: number, mission: { title: string }) => {
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
      });
      if (!category) return;
      await addRoutine({
        title: mission.title,
        category: category.id,
        repeat: 'daily',
        days: [],
        startDate: todayIso(),
        alarmEnabled: false,
        time: '',
        photoVerify: false,
      });
    },
    [houses, categories.length, ensureCategory, addRoutine],
  );
  const addMissionRoutine = useCallback(
    async (houseId: number, mission: { title: string }) => {
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

  // 집 이름과 같은(=미션 연동) 카테고리들 — 나의 방 quick-add를 막는다.
  const houseCategoryIds = useMemo(
    () => categories.filter((c) => houses.some((h) => h.name === c.name)).map((c) => c.id),
    [categories, houses],
  );

  // 현재 집 카테고리에 속한 내 루틴 (미션 카드의 연동/기여함 라벨 판정 —
  // 오늘 완료 여부가 곧 '기여함'이라 앱 재시작 후에도 라벨이 유지된다).
  const houseLinkedRoutines = useMemo(() => {
    const houseCategory = categories.find((c) => c.name === currentHouse?.name);
    if (!houseCategory) return [];
    const today = todayIso();
    return routines
      .filter((r) => r.kind === 'routine' && r.category === houseCategory.id)
      .map((r) => ({
        title: r.title,
        completedToday: (completions[r.id] ?? []).includes(today),
      }));
  }, [categories, currentHouse, routines, completions]);

  // HouseScreen은 배열 prop을 받는다 — Set에서 파생한 배열의 참조를 고정.
  const contributedMissionIdList = useMemo(
    () => [...contributedMissionIds],
    [contributedMissionIds],
  );

  /** 미션 +로 만든 연동 루틴 — 집 이름 카테고리 아래, 미션 제목과 같은 루틴. */
  const linkedRoutinesFor = useCallback(
    (houseName: string, missionTitles: string[]) => {
      const cat = categories.find((c) => c.name === houseName);
      if (!cat) return [];
      return routines.filter(
        (r) => r.kind === 'routine' && r.category === cat.id && missionTitles.includes(r.title),
      );
    },
    [categories, routines],
  );

  /** 미션 삭제 성공 시 내 연동 루틴도 함께 삭제 — 고아 연동물 방지 (#338). */
  const deleteMissionWithLinked = useCallback(
    async (houseId: number, missionId: number) => {
      const house = houses.find((h) => h.houseId === houseId);
      const mission = house?.missions?.find((m) => m.id === missionId);
      const linked = house && mission ? linkedRoutinesFor(house.name, [mission.title]) : [];
      if (!(await deleteMission(houseId, missionId))) return;
      for (const r of linked) await deleteRoutine(r.id);
      if (linked.length > 0) toast('연동된 루틴도 함께 삭제했어요');
    },
    [houses, linkedRoutinesFor, deleteMission, deleteRoutine, toast],
  );

  /** 집 나가기/삭제 성공 시 집 이름 카테고리를 루틴째 통삭제 (#338). */
  const leaveHouseWithLinked = useCallback(
    async (houseId: number) => {
      const house = houses.find((h) => h.houseId === houseId);
      const cat = house ? categories.find((c) => c.name === house.name) : undefined;
      if (!(await leaveHouse(houseId))) return;
      if (!cat) return;
      await deleteCategoryCascade(cat.id);
      toast('연동된 카테고리와 루틴도 함께 삭제했어요');
    },
    [houses, categories, leaveHouse, deleteCategoryCascade, toast],
  );

  // 미션이 사라진 연동 루틴 자동 정리 (#338) — 방장이 미션을 지웠거나 과거
  // 삭제분이 남아 미션 목록과 어긋난 경우, 데이터가 다 실린 뒤 한 번 맞춘다.
  // 미션 목록이 비면(조회 실패와 구분 불가) 건드리지 않는다.
  const sweptRef = useRef(false);
  useEffect(() => {
    if (sweptRef.current || myRoomLoading || housesLoading) return;
    if (houses.length === 0 || routines.length === 0) return;
    sweptRef.current = true;
    const orphans = houses.flatMap((h) => {
      const missions = h.missions ?? [];
      if (missions.length === 0) return [];
      const cat = categories.find((c) => c.name === h.name);
      if (!cat) return [];
      const titles = new Set(missions.map((m) => m.title));
      return routines.filter(
        (r) => r.kind === 'routine' && r.category === cat.id && !titles.has(r.title),
      );
    });
    if (orphans.length === 0) return;
    void (async () => {
      for (const r of orphans) await deleteRoutine(r.id);
      toast('사라진 미션의 연동 루틴을 정리했어요');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRoomLoading, housesLoading, houses, routines, categories]);

  /** 연동 루틴의 완료 취소를 막는다 — 미션 기여는 회수되지 않는다. */
  const toggleWithMissionGuard = useCallback(
    (id: string, date: string) => {
      const item = routines.find((r) => r.id === id);
      const done = (completions[id] ?? []).includes(date);
      if (item && done) {
        const catName = categories.find((c) => c.id === item.category)?.name;
        const house = catName ? houses.find((h) => h.name === catName) : undefined;
        const linked = house?.missions?.some(
          (m) => m.status === 'ACTIVE' && m.title === item.title,
        );
        if (linked) {
          toast('미션에 기여된 루틴은 완료를 취소할 수 없어요', 'error');
          return;
        }
      }
      return toggleCompletion(id, date, contributeLinkedMission);
    },
    [routines, completions, categories, houses, toast, toggleCompletion, contributeLinkedMission],
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

  // --- memo 화면(MyRoomScreen·HouseScreen)으로 가는 콜백/파생 prop (#539) ---
  // 인라인 화살표·렌더마다 새로 만드는 객체는 memo 경계를 무효화한다. 매 렌더
  // 마운트되지 않는 다른 화면들(RoomDecorScreen 등)은 인라인을 유지한다.
  const openDecor = useCallback(() => setScreen('decor'), []);
  const openRoutineManage = useCallback(() => setScreen('routineManage'), []);
  const openCategoryManage = useCallback(() => setScreen('categoryManage'), []);
  const openGacha = useCallback(() => setScreen('gacha'), []);
  const openMyRoom = useCallback(() => setScreen('myRoom'), []);
  const openHouseSearch = useCallback(() => setScreen('houseSearch'), []);
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
    (houseId: number, mission: { title: string }) => {
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
      const target = screen === 'addRoutine' ? addReturnScreen : BACK_SCREEN[screen];
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
      setScreen(target);
      return true;
    });
    return () => sub.remove();
  }, [screen, addReturnScreen, toast]);

  const activeTab = TAB_FOR_SCREEN[screen];

  // 화면 전환 손맛 (#446) — 들어오는 화면이 이동 방향에서 밀려 들어온다.
  // 진입(서브화면)은 우측에서, 복귀(뒤로)는 좌측에서, 탭 간 전환은 탭 순서
  // 방향에서. 페이드만 쓰면 깜빡임으로 읽혀서 항상 슬라이드를 동반한다.
  const transOpacity = useRef(new Animated.Value(1)).current;
  const transX = useRef(new Animated.Value(0)).current;
  const prevScreenRef = useRef<Screen>(screen);
  useEffect(() => {
    const prev = prevScreenRef.current;
    if (prev === screen) return;
    prevScreenRef.current = screen;
    const TAB_ORDER: Record<NavTab, number> = { myRoom: 0, house: 1, settings: 2 };
    const prevTab = TAB_FOR_SCREEN[prev];
    const nextTab = TAB_FOR_SCREEN[screen];
    const tabToTab = prevTab != null && nextTab != null;
    let slide = 28; // 기본: 서브화면 진입(우측에서)
    if (tabToTab) {
      // 탭 간 전환 — 이동 방향에서 들어온다.
      slide = TAB_ORDER[nextTab!] > TAB_ORDER[prevTab!] ? 32 : -32;
    } else if (
      BACK_SCREEN[prev] === screen ||
      (prev === 'addRoutine' && screen === addReturnScreen) ||
      nextTab != null
    ) {
      // 뒤로 복귀(백맵 목적지·서브→탭) — 좌측에서 되돌아온다.
      slide = -28;
    }
    // 페이드가 짧으면 깜빡임으로 읽힌다 — 서브화면은 바닥 0.08에서 넉넉히,
    // 무거운 탭 화면은 페이드 자체가 깜빡임이라 슬라이드만 쓴다.
    transOpacity.setValue(tabToTab ? 1 : 0.08);
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
    <CoachTargetProvider>
      <View
        ref={shellRef}
        style={styles.root}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          // 대상 좌표(윈도 기준)를 셸 좌표로 옮길 원점도 같이 잰다.
          shellRef.current?.measureInWindow((x, y) => {
            shellOrigin.current = { x, y };
            setShellFrame({ w: width, h: height });
          });
        }}>
        <Animated.View
          style={[styles.content, { opacity: transOpacity, transform: [{ translateX: transX }] }]}>
          {screen === 'myRoom' ? (
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
              onQuickAddRoutine={quickAddTodo}
              quickAddDisabledCategoryIds={houseCategoryIds}
              onRenameRoutine={renameRoutine}
              onEditRoutine={editRoutineFromMyRoom}
              onUpdateRoutineTime={updateRoutineTime}
              onUpdateTodoDueDate={updateTodoDueDate}
              onMoveRoutineOccurrence={moveRoutineOccurrence}
              onDeleteRoutine={deleteRoutine}
            />
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
              onAdd={addRoutine}
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
            />
          ) : null}

          {screen === 'house' ? (
            <HouseScreen
              houses={arrangedHouses}
              onSwapSeats={swapSeats}
              loading={housesLoading}
              loadError={housesError}
              onRetry={retryHouses}
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
              onBack={() => setScreen('house')}
              onJoinByCode={async (code) => {
                const ok = await joinByCode(code);
                if (ok === true) setScreen('house');
                return ok;
              }}
              onPreviewCode={previewByCode}
              // 카탈로그를 얹어 미리보기 창문에 실제 방을 그린다 (#386).
              onPreviewHouse={(houseId) => previewHouse(houseId, catalogue)}
              furniture={catalogue.furniture}
              wallpapers={catalogue.wallpapers}
              floors={catalogue.floors}
              backgrounds={catalogue.backgrounds}
              onJoinHouse={(houseId) => {
                void joinSearchHouse(houseId).then((ok) => ok && setScreen('house'));
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

          {screen === 'settings' ? (
            <SettingsScreen
              themeMode={themeMode}
              onChangeThemeMode={setThemeMode}
              fontId={fontId}
              onChangeFont={setFontId}
              onOpenTheme={() => setScreen('theme')}
              onEditProfile={() => setScreen('profileEdit')}
              onChangePassword={() => setScreen('passwordChange')}
              onOpenNotifications={() => {
                setScreen('notifications');
                // 화면을 열 때마다 서버값으로 최신화 (실패 시 기본값/직전값 유지).
                void loadNotificationSettings();
              }}
              onOpenSound={() => setScreen('sound')}
              onOpenHelp={() => setScreen('help')}
              onOpenTerms={() => openExternal(PolicyUrls.terms)}
              onOpenPrivacy={() => openExternal(PolicyUrls.privacy)}
              onReportBug={() => {
                setScreen('bugReport');
                void loadBugReports();
              }}
              onReplayOnboarding={onReplayOnboarding}
              onLogout={() => {
                // Clearing the session flips auth status → AppRoot redirects to /login.
                void logout();
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
        </Animated.View>

        {activeTab ? (
          <BottomNav active={activeTab} onChange={(tab) => setScreen(SCREEN_FOR_TAB[tab])} />
        ) : null}
        {tutorialIdx != null ? (
          <TutorialLayer
            index={tutorialIdx}
            frame={shellFrame}
            origin={shellOrigin.current}
            onNext={advanceTutorial}
            onSkip={() => setTutorialIdx(null)}
          />
        ) : null}
      </View>
    </CoachTargetProvider>
  );
}

/** 코치마크 오버레이 호스트 — 대상 좌표를 셸 좌표계로 보정해 그린다 (#351). */
function TutorialLayer({
  index,
  frame,
  origin,
  onNext,
  onSkip,
}: {
  index: number;
  frame: { w: number; h: number };
  origin: { x: number; y: number };
  onNext: () => void;
  onSkip: () => void;
}) {
  const targets = useCoachTargets();
  const adjusted = Object.fromEntries(
    Object.entries(targets).map(([k, r]) => [k, { ...r, x: r.x - origin.x, y: r.y - origin.y }]),
  );
  return (
    <CoachMarkOverlay
      steps={TUTORIAL_STEPS}
      index={index}
      targets={adjusted}
      frame={frame}
      onNext={onNext}
      onSkip={onSkip}
    />
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
