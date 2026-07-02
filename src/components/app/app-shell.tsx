import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CreateHouseScreen } from '@/components/screens/create-house-screen';
import { FriendRoomScreen } from '@/components/screens/friend-room-screen';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { GroupHouseScreen } from '@/components/screens/group-house-screen';
import { HelpScreen } from '@/components/screens/help-screen';
import { HouseSearchScreen } from '@/components/screens/house-search-screen';
import { MyRoomScreen } from '@/components/screens/my-room-screen';
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
import { type Routine } from '@/constants/routines';
import { useAuth } from '@/hooks/use-auth';
import { useGacha } from '@/hooks/use-gacha';
import { useMyRoomData } from '@/hooks/use-my-room-data';
import { useBrandTheme } from '@/hooks/use-tokens';
import {
  DEFAULT_PLACED_FURNITURE_IDS,
  DEFAULT_WALLPAPER_ID,
  FURNITURE_ITEMS,
} from '@/resources/furniture';

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
  notifications: null,
  sound: null,
  help: null,
};

const SCREEN_FOR_TAB: Record<NavTab, Screen> = {
  myRoom: 'myRoom',
  house: 'groupHouse',
  settings: 'settings',
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
  const { themeId, setThemeId } = useBrandTheme();
  const [screen, setScreen] = useState<Screen>('myRoom');

  // Routines / todos / categories / completion / wallet come from the API.
  const {
    routines,
    completions,
    categories,
    wallet,
    setWallet,
    nickname: apiNickname,
    streak,
    toggleCompletion,
    quickAddTodo,
    addRoutine,
    updateRoutine,
    renameRoutine,
    updateRoutineTime,
    deleteRoutine,
    createRoutineCategory,
    deleteRoutineCategory,
  } = useMyRoomData();

  // Gacha machines + draw (spend + dupe→dia handled server-side; wallet synced
  // from the draw response).
  const { gachas, draw: drawGachaMachine } = useGacha(setWallet);

  const { logout } = useAuth();

  const [placedFurnitureIds, setPlacedFurnitureIds] = useState<string[]>(
    DEFAULT_PLACED_FURNITURE_IDS,
  );
  const [wallpaperId, setWallpaperId] = useState(DEFAULT_WALLPAPER_ID);
  const [ownedFurnitureIds, setOwnedFurnitureIds] = useState<string[]>(() =>
    FURNITURE_ITEMS.map((i) => i.id),
  );
  const [visitingFriend, setVisitingFriend] = useState('친구');
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);

  // Profile + settings. Nickname seeds from the API (/me); there's no PUT /me
  // yet, so profile-edit saves + bio stay local.
  const [nickname, setNickname] = useState('준서');
  const [bio, setBio] = useState('');
  useEffect(() => {
    if (apiNickname) setNickname(apiNickname);
  }, [apiNickname]);
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

  const activeTab = TAB_FOR_SCREEN[screen];

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {screen === 'myRoom' ? (
          <MyRoomScreen
            userName={nickname}
            streakDays={streak}
            routines={routines}
            completions={completions}
            categories={categories}
            placedFurnitureIds={placedFurnitureIds}
            wallpaperId={wallpaperId}
            characterId={characterId}
            onToggleCompletion={toggleCompletion}
            onEdit={() => setScreen('decor')}
            onAddRoutine={() => setScreen('routineManage')}
            onOpenGacha={() => setScreen('gacha')}
            onQuickAddRoutine={quickAddTodo}
            onRenameRoutine={renameRoutine}
            onUpdateRoutineTime={updateRoutineTime}
            onDeleteRoutine={deleteRoutine}
          />
        ) : null}

        {screen === 'decor' ? (
          <RoomDecorScreen
            initialPlacedIds={placedFurnitureIds}
            initialWallpaperId={wallpaperId}
            ownedIds={ownedFurnitureIds}
            coinBalance={wallet.coin}
            diaBalance={wallet.dia}
            characterId={characterId}
            onBuy={(itemId) => {
              const item = FURNITURE_ITEMS.find((i) => i.id === itemId);
              if (!item || ownedFurnitureIds.includes(itemId) || wallet.dia < item.price) return;
              setWallet((w) => ({ ...w, dia: w.dia - item.price }));
              setOwnedFurnitureIds((prev) => Array.from(new Set([...prev, itemId])));
            }}
            onApply={(ids, wp) => {
              setPlacedFurnitureIds(ids);
              setWallpaperId(wp);
            }}
            onBack={() => setScreen('myRoom')}
          />
        ) : null}

        {screen === 'routineManage' ? (
          <RoutineManageScreen
            routines={routines}
            categories={categories}
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
            onDeleteCategory={deleteRoutineCategory}
            onBack={() => setScreen(addReturnScreen)}
          />
        ) : null}

        {screen === 'gacha' ? (
          <GachaScreen
            gachas={gachas}
            coinBalance={wallet.coin}
            diaBalance={wallet.dia}
            onBack={() => setScreen('myRoom')}
            onDraw={drawGachaMachine}
          />
        ) : null}

        {screen === 'groupHouse' ? (
          <GroupHouseScreen
            coinBalance={wallet.coin}
            characterId={characterId}
            onVisitFriend={(name) => {
              setVisitingFriend(name);
              setScreen('friendRoom');
            }}
            onVisitMyRoom={() => setScreen('myRoom')}
            onOpenSearch={() => setScreen('houseSearch')}
          />
        ) : null}

        {screen === 'friendRoom' ? (
          <FriendRoomScreen
            friendName={visitingFriend}
            placedFurnitureIds={placedFurnitureIds}
            wallpaperId={wallpaperId}
            characterId={characterId}
            routines={routines}
            onBack={() => setScreen('groupHouse')}
          />
        ) : null}

        {screen === 'houseSearch' ? (
          <HouseSearchScreen
            onBack={() => setScreen('groupHouse')}
            onJoin={() => setScreen('groupHouse')}
            onCreate={() => setScreen('createHouse')}
          />
        ) : null}

        {screen === 'createHouse' ? (
          <CreateHouseScreen
            onBack={() => setScreen('houseSearch')}
            onCreate={() => setScreen('groupHouse')}
          />
        ) : null}

        {screen === 'settings' ? (
          <SettingsScreen
            themeId={themeId}
            onChangeTheme={setThemeId}
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
            characterId={characterId}
            onSave={(nick, b) => {
              setNickname(nick);
              setBio(b);
              setScreen('settings');
            }}
            onBack={() => setScreen('settings')}
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
