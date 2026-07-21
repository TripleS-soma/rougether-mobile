import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

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
import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { SettingsScreen } from '@/components/screens/settings-screen';
import {
  DEFAULT_SOUND_SETTINGS,
  type SoundSettings,
  SoundSettingsScreen,
} from '@/components/screens/sound-settings-screen';
import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { BottomNav, type NavTab } from '@/components/ui/bottom-nav';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { CATEGORY_COLORS, type Routine } from '@/constants/routines';
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
import { useBrandTheme } from '@/hooks/use-tokens';
import { DEFAULT_WALLPAPER_ID, type PlacedFurniture } from '@/resources/furniture';

type Screen =
  | 'myRoom'
  | 'decor'
  | 'routineManage'
  | 'addRoutine'
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

export type AppShellProps = {
  /** Character chosen at onboarding; defaults to the sample character. */
  characterId?: CharacterId;
  /** Re-run the first-launch onboarding (설정 → 온보딩 다시 보기). */
  onReplayOnboarding?: () => void;
};

/**
 * The app shell that wires every non-auth screen together with shared state:
 * 나의 방 / 집 / 설정 tabs plus the pushed sub-screens (decor, routine manage/add,
 * gacha, friend room, house search/create). Mirrors the prototype App.tsx
 * navigation, minus the auth flow.
 */
export function AppShell({
  characterId = DEFAULT_CHARACTER_ID,
  onReplayOnboarding,
}: AppShellProps) {
  const { mode: themeMode, setMode: setThemeMode } = useBrandTheme();
  const [screen, setScreen] = useState<Screen>('myRoom');

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
    void toggleCompletion(id, date, contributeLinkedMission);
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

  return (
    <View style={styles.root}>
      <View style={styles.content}>
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
            onAddRoutine={() => setScreen('routineManage')}
            onOpenNotifications={() => {
              void loadNotifications();
              setScreen('notificationList');
            }}
            unreadNotificationCount={unreadCount}
            ownedCharacters={ownedCharacters}
            onSelectCharacter={(serverId) => {
              void selectWornCharacter(serverId);
            }}
            onCreateCategory={createRoutineCategory}
            onUpdateCategory={updateRoutineCategory}
            onDeleteCategory={deleteRoutineCategory}
            onReorderCategories={(orderedIds) => {
              void reorderCategories(orderedIds);
            }}
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
            inUseCategoryIds={Array.from(
              new Set(routines.map((r) => r.category).filter((c): c is string => !!c)),
            )}
            editRoutine={editingRoutine}
            onAdd={addRoutine}
            onUpdate={updateRoutine}
            onDelete={deleteRoutine}
            onCreateCategory={createRoutineCategory}
            onUpdateCategory={updateRoutineCategory}
            onDeleteCategory={deleteRoutineCategory}
            onReorderCategories={(orderedIds) => {
              void reorderCategories(orderedIds);
            }}
            onBack={() => setScreen(addReturnScreen)}
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
            roomPreviews={roomPreviews}
            furniture={catalogue.furniture}
            wallpapers={catalogue.wallpapers}
            floors={catalogue.floors}
            backgrounds={catalogue.backgrounds}
            houseIndex={houseIndex}
            onHouseIndexChange={setHouseIndex}
            onVisitFriend={(friend) => {
              setVisitingFriend(friend);
              void loadGuestbook(friend.userId, friend.houseId);
              void loadFriendRoom(friend.houseId, friend.membershipId, catalogue);
              setScreen('friendRoom');
            }}
            onVisitMyRoom={() => setScreen('myRoom')}
            onOpenSearch={() => setScreen('houseSearch')}
            onKickMember={(houseId, membershipId) => {
              void kickMember(houseId, membershipId);
            }}
            onLeaveHouse={(houseId) => {
              void leaveHouse(houseId);
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
              void deleteMission(houseId, missionId);
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
            onPreviewHouse={previewHouse}
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
            onChange={setNotificationSettings}
            onBack={() => setScreen('settings')}
          />
        ) : null}

        {screen === 'sound' ? (
          <SoundSettingsScreen
            initialSettings={soundSettings}
            onChange={setSoundSettings}
            onBack={() => setScreen('settings')}
          />
        ) : null}

        {screen === 'help' ? <HelpScreen onBack={() => setScreen('settings')} /> : null}
      </View>

      {activeTab ? (
        <BottomNav active={activeTab} onChange={(tab) => setScreen(SCREEN_FOR_TAB[tab])} />
      ) : null}
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
