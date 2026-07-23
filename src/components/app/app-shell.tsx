import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, StyleSheet, View } from 'react-native';

import { CreateHouseScreen } from '@/components/screens/create-house-screen';
import { FriendRoomScreen } from '@/components/screens/friend-room-screen';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { GroupHouseScreen, type VisitedFriend } from '@/components/screens/group-house-screen';
import { HelpScreen } from '@/components/screens/help-screen';
import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { MyRoomScreen } from '@/components/screens/my-room-screen';
import { NotificationListScreen } from '@/components/screens/notification-list-screen';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
  NotificationSettingsScreen,
} from '@/components/screens/notification-settings-screen';
import { PasswordChangeScreen } from '@/components/screens/password-change-screen';
import { ProfileEditScreen } from '@/components/screens/profile-edit-screen';
import { RoomDecorScreen } from '@/components/screens/room-decor-screen';
import { CategoryManageScreen } from '@/components/screens/category-manage-screen';
import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';
import {
  DEFAULT_SOUND_SETTINGS,
  type SoundSettings,
  SoundSettingsScreen,
} from '@/components/screens/sound-settings-screen';
import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { BottomNav, type NavTab } from '@/components/ui/bottom-nav';
import {
  CoachMarkOverlay,
  type CoachStep,
  CoachTargetProvider,
  useCoachTargets,
} from '@/components/ui/coach-mark';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { CATEGORY_COLORS, type Routine } from '@/constants/routines';
import { screenView, track } from '@/lib/analytics';
import { onNotificationTap } from '@/lib/push-events';
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
import { useNotifications } from '@/hooks/use-notifications';
import { useShop } from '@/hooks/use-shop';
import { useWeather } from '@/hooks/use-weather';
import { useBrandTheme } from '@/hooks/use-tokens';
import { DEFAULT_WALLPAPER_ID, type PlacedFurniture } from '@/resources/furniture';

type Screen =
  | 'myRoom'
  | 'decor'
  | 'routineManage'
  | 'addRoutine'
  | 'categoryManage'
  | 'gacha'
  | 'groupHouse'
  | 'friendRoom'
  | 'houseSearch'
  | 'createHouse'
  | 'settings'
  | 'profileEdit'
  | 'passwordChange'
  | 'notificationList'
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
  groupHouse: 'house',
  friendRoom: null,
  houseSearch: null,
  createHouse: null,
  settings: 'settings',
  profileEdit: null,
  passwordChange: null,
  notificationList: null,
  notifications: null,
  sound: null,
  help: null,
};

const SCREEN_FOR_TAB: Record<NavTab, Screen> = {
  myRoom: 'myRoom',
  house: 'groupHouse',
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
  groupHouse: 'myRoom',
  friendRoom: 'groupHouse',
  houseSearch: 'groupHouse',
  createHouse: 'houseSearch',
  settings: 'myRoom',
  profileEdit: 'settings',
  passwordChange: 'settings',
  notificationList: 'myRoom',
  notifications: 'settings',
  sound: 'settings',
  help: 'settings',
};

/** 알림/사운드 설정의 기기 보관 키 (#405) — 서버 설정 API가 생기면 마이그레이션. */
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
    screen: 'groupHouse',
    target: 'house-frame',
    title: '우리 집',
    body: '창문 속이 친구들의 방이에요. 탭하면 방문하고, 두 번 탭하면 확대돼요.',
  },
  {
    screen: 'groupHouse',
    target: 'house-missions',
    title: '공동 미션',
    body: '집 친구들과 함께 미션을 수행하면 집이 성장해요.',
  },
  {
    screen: 'groupHouse',
    target: 'house-search',
    title: '집 탐색',
    body: '새로운 집을 찾아 입주하거나 초대코드로 들어갈 수 있어요.',
  },
  {
    screen: 'groupHouse',
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
  const { mode: themeMode, setMode: setThemeMode, fontId, setFontId } = useBrandTheme();
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

  // Gacha machines + draw (spend + dupe→dia handled server-side; wallet synced
  // from the draw response).
  const { gachas, loading: gachasLoading, draw: drawGachaMachine } = useGacha(setWallet);

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

  // 알림 (list + read receipts); loaded on mount so the header bell can show
  // the unread dot, refreshed each time the list opens.
  const {
    entries: notificationEntries,
    unreadCount,
    loading: notificationsLoading,
    hasNext: notificationsHasNext,
    load: loadNotifications,
    loadMore: loadMoreNotifications,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
  } = useNotifications();
  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // Group houses (내 집 목록 + 탐색 + 참여/생성/강퇴/나가기) from the API.
  const {
    houses,
    searchHouses,
    loading: housesLoading,
    searchLoading,
    previewByCode,
    previewHouse,
    joinByCode,
    joinHouse: joinSearchHouse,
    create: createGroupHouse,
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

  // Selectable house-cover catalog (집 생성·집 정보 수정).
  const { covers: houseCovers } = useHouseCovers();

  // Shop catalogue + purchase (dia via API; wallet synced from the purchase
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
  // Which house the 집 switcher is on — kept here because GroupHouseScreen
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
    if (screen !== 'groupHouse' || !currentHouse?.houseId) return;
    const membershipIds = currentHouse.floors
      .flatMap((f) => f.rooms.map((r) => r.membershipId))
      .filter((id): id is number => id != null);
    // catalogueReady=!shopLoading: an EMPTY pre-load catalogue must not fill
    // the per-house cache with blank rooms (the effect re-fires when it lands).
    void loadRoomPreviews(currentHouse.houseId, membershipIds, catalogue, !shopLoading);
  }, [screen, currentHouse, catalogue, shopLoading, loadRoomPreviews]);

  // --- 공동미션 ↔ 내 루틴 연동 (#272). Link convention: 카테고리명 == 집 이름,
  // 루틴명 == 미션명 — the server has no link field, so names carry it.
  const contributeLinkedMission = (item: Routine) => {
    const categoryLabel = categories.find((c) => c.id === item.category)?.label;
    if (!categoryLabel) return;
    const house = houses.find((h) => h.title === categoryLabel);
    const mission = house?.missions?.find((m) => m.status === 'ACTIVE' && m.title === item.title);
    if (house?.houseId && mission && !contributedMissionIds.has(mission.id))
      void contributeMission(house.houseId, mission.id);
  };

  /** 미션의 + → 집 이름 카테고리(없으면 생성) 아래 매일 루틴 생성. */
  const addingMissionRef = useRef(false);
  const addMissionRoutine = async (houseId: number, mission: { title: string }) => {
    // A double-fired press must not create the category twice.
    if (addingMissionRef.current) return;
    addingMissionRef.current = true;
    try {
      await addMissionRoutineInner(houseId, mission);
    } finally {
      addingMissionRef.current = false;
    }
  };
  const addMissionRoutineInner = async (houseId: number, mission: { title: string }) => {
    const house = houses.find((h) => h.houseId === houseId);
    if (!house) return;
    // Server-fresh find-or-create — stale local state must not duplicate it.
    const category = await ensureCategory({
      id: '',
      label: house.title,
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
  };

  // 집 이름과 같은(=미션 연동) 카테고리들 — 나의 방 quick-add를 막는다.
  const houseCategoryIds = categories
    .filter((c) => houses.some((h) => h.title === c.label))
    .map((c) => c.id);

  // 현재 집 카테고리에 속한 내 루틴 (미션 카드의 연동/기여함 라벨 판정 —
  // 오늘 완료 여부가 곧 '기여함'이라 앱 재시작 후에도 라벨이 유지된다).
  const houseCategory = categories.find((c) => c.label === currentHouse?.title);
  const houseLinkedRoutines = houseCategory
    ? routines
        .filter((r) => r.kind === 'routine' && r.category === houseCategory.id)
        .map((r) => ({
          title: r.title,
          completedToday: (completions[r.id] ?? []).includes(todayIso()),
        }))
    : [];

  /** 미션 +로 만든 연동 루틴 — 집 이름 카테고리 아래, 미션 제목과 같은 루틴. */
  const linkedRoutinesFor = (houseTitle: string, missionTitles: string[]) => {
    const cat = categories.find((c) => c.label === houseTitle);
    if (!cat) return [];
    return routines.filter(
      (r) => r.kind === 'routine' && r.category === cat.id && missionTitles.includes(r.title),
    );
  };

  /** 미션 삭제 성공 시 내 연동 루틴도 함께 삭제 — 고아 연동물 방지 (#338). */
  const deleteMissionWithLinked = async (houseId: number, missionId: number) => {
    const house = houses.find((h) => h.houseId === houseId);
    const mission = house?.missions?.find((m) => m.id === missionId);
    const linked = house && mission ? linkedRoutinesFor(house.title, [mission.title]) : [];
    if (!(await deleteMission(houseId, missionId))) return;
    for (const r of linked) await deleteRoutine(r.id);
    if (linked.length > 0) toast('연동된 루틴도 함께 삭제했어요');
  };

  /** 집 나가기/삭제 성공 시 집 이름 카테고리를 루틴째 통삭제 (#338). */
  const leaveHouseWithLinked = async (houseId: number) => {
    const house = houses.find((h) => h.houseId === houseId);
    const cat = house ? categories.find((c) => c.label === house.title) : undefined;
    if (!(await leaveHouse(houseId))) return;
    if (!cat) return;
    await deleteCategoryCascade(cat.id);
    toast('연동된 카테고리와 루틴도 함께 삭제했어요');
  };

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
      const cat = categories.find((c) => c.label === h.title);
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
  const toggleWithMissionGuard = (id: string, date: string) => {
    const item = routines.find((r) => r.id === id);
    const done = (completions[id] ?? []).includes(date);
    if (item && done) {
      const label = categories.find((c) => c.id === item.category)?.label;
      const house = label ? houses.find((h) => h.title === label) : undefined;
      const linked = house?.missions?.some((m) => m.status === 'ACTIVE' && m.title === item.title);
      if (linked) {
        toast('미션에 기여된 루틴은 완료를 취소할 수 없어요', 'error');
        return;
      }
    }
    return toggleCompletion(id, date, contributeLinkedMission);
  };
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
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS,
  );
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS);

  // 알림/사운드 설정은 서버 API가 생기기 전까지 기기(AsyncStorage)에 보관 (#405)
  // — 화면 문구("이 기기에만 저장돼요")와 실제 동작을 일치시킨다.
  useEffect(() => {
    void AsyncStorage.getItem(DEVICE_SETTINGS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as {
          notifications?: NotificationSettings;
          sound?: SoundSettings;
        };
        if (saved.notifications) setNotificationSettings((p) => ({ ...p, ...saved.notifications }));
        if (saved.sound) setSoundSettings((p) => ({ ...p, ...saved.sound }));
      } catch {
        // 손상된 저장값은 기본값으로 무시.
      }
    });
  }, []);
  const persistDeviceSettings = (notifications: NotificationSettings, sound: SoundSettings) => {
    void AsyncStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify({ notifications, sound })).catch(
      () => {},
    );
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
  const openEditRoutine = (routine: Routine, from: Screen) => {
    setEditingRoutine(routine);
    setAddReturnScreen(from);
    setScreen('addRoutine');
  };

  // Android hardware back navigates the shell's own screen stack instead of
  // exiting the app; only myRoom falls through to the OS default.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const target = screen === 'addRoutine' ? addReturnScreen : BACK_SCREEN[screen];
      if (!target) return false;
      setScreen(target);
      return true;
    });
    return () => sub.remove();
  }, [screen, addReturnScreen]);

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
    let slide = 28; // 기본: 서브화면 진입(우측에서)
    if (prevTab != null && nextTab != null) {
      // 탭 간 전환 — 이동 방향에서 들어온다.
      slide = TAB_ORDER[nextTab] > TAB_ORDER[prevTab] ? 24 : -24;
    } else if (
      BACK_SCREEN[prev] === screen ||
      (prev === 'addRoutine' && screen === addReturnScreen) ||
      nextTab != null
    ) {
      // 뒤로 복귀(백맵 목적지·서브→탭) — 좌측에서 되돌아온다.
      slide = -28;
    }
    // 페이드가 짧으면 깜빡임으로 읽힌다 — 바닥을 0.08로 띄우고 넉넉하게.
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
              diaBalance={wallet.dia}
              routines={routines}
              completions={completions}
              categories={categories}
              allCategories={allCategories}
              calendarDays={calendarDays}
              onSelectDate={(date) => {
                void loadCalendarDay(date);
              }}
              onToggleCalendarItem={(item, date) => {
                void toggleCalendarItem(item, date);
              }}
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
              onEdit={() => setScreen('decor')}
              // + 버튼은 바로 추가 화면으로 — 뒤로 가면 나의 방으로 복귀 (#335).
              onAddRoutine={() => {
                setEditingRoutine(null);
                setAddReturnScreen('myRoom');
                setScreen('addRoutine');
              }}
              onManageRoutines={() => setScreen('routineManage')}
              onOpenNotifications={() => {
                void loadNotifications();
                setScreen('notificationList');
              }}
              unreadNotificationCount={unreadCount}
              ownedCharacters={ownedCharacters}
              onSelectCharacter={(serverId) => {
                void selectWornCharacter(serverId);
              }}
              onManageCategories={() => setScreen('categoryManage')}
              onOpenGacha={() => setScreen('gacha')}
              onQuickAddRoutine={quickAddTodo}
              quickAddDisabledCategoryIds={houseCategoryIds}
              onRenameRoutine={renameRoutine}
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
              diaBalance={wallet.dia}
              characterId={wornCharacterId}
              characterAnimations={wornCharacterAnimations}
              onBuy={(itemId) => {
                void purchaseFurniture(itemId);
              }}
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
              inUseCategoryIds={Array.from(
                new Set(routines.map((r) => r.category).filter((c): c is string => !!c)),
              )}
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
              coinBalance={wallet.coin}
              diaBalance={wallet.dia}
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

          {screen === 'groupHouse' ? (
            <GroupHouseScreen
              houses={arrangedHouses}
              onSwapSeats={swapSeats}
              loading={housesLoading}
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
              onVisitFriend={(friend) => {
                track('friend_room_visit');
                setVisitingFriend(friend);
                void loadGuestbook(friend.userId, friend.houseId);
                void loadFriendRoom(friend.houseId, friend.membershipId, catalogue);
                setScreen('friendRoom');
              }}
              onVisitMyRoom={() => setScreen('myRoom')}
              onOpenSearch={() => setScreen('houseSearch')}
              coinBalance={wallet.coin}
              diaBalance={wallet.dia}
              raining={raining}
              onKickMember={(houseId, membershipId) => {
                void kickMember(houseId, membershipId);
              }}
              onLeaveHouse={(houseId) => {
                void leaveHouseWithLinked(houseId);
              }}
              linkedRoutines={houseLinkedRoutines}
              contributedMissionIds={[...contributedMissionIds]}
              onAddMissionRoutine={(houseId, mission) => {
                void addMissionRoutine(houseId, mission);
              }}
              onClaimMission={(houseId, missionId) => {
                void claimMission(houseId, missionId);
              }}
              onCreateMission={(houseId, input) => {
                void createMission(houseId, input);
              }}
              onDeleteMission={(houseId, missionId) => {
                void deleteMissionWithLinked(houseId, missionId);
              }}
              onUpdateHouse={(houseId, input) => {
                void updateHouse(houseId, input);
              }}
              onTransferOwnership={(houseId, membershipId) => {
                void transferOwnership(houseId, membershipId);
              }}
              onReissueInviteCode={(houseId) => {
                void reissueInviteCode(houseId);
              }}
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
              onBack={() => setScreen('groupHouse')}
            />
          ) : null}

          {screen === 'houseSearch' ? (
            <HouseSearchScreen
              houses={searchHouses}
              loading={searchLoading}
              onBack={() => setScreen('groupHouse')}
              onJoinByCode={async (code) => {
                const ok = await joinByCode(code);
                if (ok) setScreen('groupHouse');
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
                void joinSearchHouse(houseId).then((ok) => ok && setScreen('groupHouse'));
              }}
              onCreate={() => setScreen('createHouse')}
            />
          ) : null}

          {screen === 'createHouse' ? (
            <CreateHouseScreen
              covers={houseCovers}
              onBack={() => setScreen('houseSearch')}
              onCreate={(input) => {
                void createGroupHouse(input).then((ok) => ok && setScreen('groupHouse'));
              }}
            />
          ) : null}

          {screen === 'settings' ? (
            <SettingsScreen
              themeMode={themeMode}
              onChangeThemeMode={setThemeMode}
              fontId={fontId}
              onChangeFont={setFontId}
              onEditProfile={() => setScreen('profileEdit')}
              onChangePassword={() => setScreen('passwordChange')}
              onOpenNotifications={() => setScreen('notifications')}
              onOpenSound={() => setScreen('sound')}
              onOpenHelp={() => setScreen('help')}
              onReplayOnboarding={onReplayOnboarding}
              onLogout={() => {
                // Clearing the session flips auth status → AppRoot redirects to /login.
                void logout();
              }}
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
              initialSettings={notificationSettings}
              onChange={(next) => {
                setNotificationSettings(next);
                persistDeviceSettings(next, soundSettings);
              }}
              onBack={() => setScreen('settings')}
            />
          ) : null}

          {screen === 'sound' ? (
            <SoundSettingsScreen
              initialSettings={soundSettings}
              onChange={(next) => {
                setSoundSettings(next);
                persistDeviceSettings(notificationSettings, next);
              }}
              onBack={() => setScreen('settings')}
            />
          ) : null}

          {screen === 'help' ? <HelpScreen onBack={() => setScreen('settings')} /> : null}
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
