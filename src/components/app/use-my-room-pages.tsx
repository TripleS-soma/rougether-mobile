import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { type Screen } from '@/components/app/navigation';
import type { useMissionLinks } from '@/components/app/use-mission-links';
import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { CategoryManageScreen } from '@/components/screens/category-manage-screen';
import { type CalendarDayItem, type MyRoomScreenProps } from '@/components/screens/my-room-screen';
import { NotificationListScreen } from '@/components/screens/notification-list-screen';
import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { CHARACTER_SELECTION_ENABLED, type CharacterId } from '@/constants/characters';
import { type Routine } from '@/constants/routines';
import type { useMyRoomData } from '@/hooks/use-my-room-data';
import { useNotifications } from '@/hooks/use-notifications';
import { useRoutineOrder } from '@/hooks/use-routine-order';
import { useWalletHistory } from '@/hooks/use-wallet-history';
import { track } from '@/lib/analytics';
import { onNotificationTap } from '@/lib/push-events';
import type { ShopCatalogue } from '@/api/adapters';

type MyRoomData = ReturnType<typeof useMyRoomData>;
type MissionLinks = ReturnType<typeof useMissionLinks>;

/**
 * 나의 방 페이지 배선 (#692 5단계) — 나의 방 탭 페이지와 그 서브화면 4종
 * (루틴 관리·루틴 추가·카테고리 관리·알림 목록)의 훅·콜백·JSX를 소유한다.
 * 알림 훅(헤더 벨 배지)과 편집 중 루틴 상태는 서브화면 이동으로 탭 페이저가
 * 언마운트돼도 유지돼야 하므로 항상 마운트된 셸 수명에서 이 훅으로 산다
 * (설정 서피스와 같은 제약, #692 2단계 참조). 셸은 `tabProps`를
 * `<MyRoomScreen {...tabProps} />`로 스프레드하고 `subScreen`을 렌더만 한다.
 * 꾸미기·뽑기 서브화면은 상점·뽑기 도메인이라 셸에 남는다 (6단계 범위).
 */
export function useMyRoomPages({
  nav,
  data,
  nickname,
  missionLinks,
  character,
  room,
}: {
  /** 셸 내비 상태 — 추가/수정 화면의 복귀 목적지 포함. */
  nav: {
    screen: Screen;
    setScreen: Dispatch<SetStateAction<Screen>>;
    addReturnScreen: Screen;
    setAddReturnScreen: Dispatch<SetStateAction<Screen>>;
  };
  /** useMyRoomData 파생값 — 호출 자체는 교차 도메인 소비자(위젯 요약·미션
   * 연동·프로필 등)가 있어 셸에 남고, 이 훅은 필요한 조각만 받는다. */
  data: Pick<
    MyRoomData,
    | 'routines'
    | 'completions'
    | 'categories'
    | 'allCategories'
    | 'calendarDays'
    | 'loadCalendarDay'
    | 'wallet'
    | 'streak'
    | 'loading'
    | 'error'
    | 'retry'
    | 'reload'
    | 'toggleCalendarItem'
    | 'quickAddTodo'
    | 'updateRoutine'
    | 'renameRoutine'
    | 'moveRoutineToCategory'
    | 'updateRoutineTime'
    | 'updateTodoDueDate'
    | 'moveRoutineOccurrence'
    | 'deleteRoutine'
    | 'createRoutineCategory'
    | 'updateRoutineCategory'
    | 'deleteRoutineCategory'
    | 'reorderCategories'
  >;
  /** 나의 방 헤더 표시용 닉네임 — 설정 프로필 편집과 공유라 셸 소유. */
  nickname: string;
  /** 공동미션 연동 (#272 → #578) — 완료 가드·quick-add 금지 카테고리·
   * 루틴 등록 시 온보딩 미션 완료(addRoutineWithMission). */
  missionLinks: {
    toggleWithMissionGuard: MissionLinks['toggleWithMissionGuard'];
    houseCategoryIds: MissionLinks['houseCategoryIds'];
    addRoutineWithMission: (n: Parameters<MyRoomData['addRoutine']>[0]) => Promise<boolean>;
  };
  /** 착용 캐릭터 — 뽑기 후 리로드 등 다른 소비자가 있어 셸 소유. */
  character: {
    wornCharacterId: CharacterId;
    wornCharacterFrames: MyRoomScreenProps['characterFrames'];
    ownedCharacters: MyRoomScreenProps['ownedCharacters'];
    wearCharacter: (serverId: number) => void;
  };
  /** 방 렌더 prop — 배치 상태·카탈로그는 꾸미기(셸 잔류)와 공유라 셸 소유. */
  room: {
    placedFurnitureIds: string[];
    placements: MyRoomScreenProps['placements'];
    wallpaperId: string;
    floorId: string | null;
    backgroundId: string | null;
    catalogue: ShopCatalogue;
  };
}) {
  const { screen, setScreen, addReturnScreen, setAddReturnScreen } = nav;
  const {
    routines,
    completions,
    categories,
    allCategories,
    calendarDays,
    loadCalendarDay,
    wallet,
    streak,
    loading: myRoomLoading,
    error: myRoomError,
    retry: retryMyRoom,
    reload: reloadMyRoom,
    toggleCalendarItem,
    quickAddTodo,
    updateRoutine,
    renameRoutine,
    moveRoutineToCategory,
    updateRoutineTime,
    updateTodoDueDate,
    moveRoutineOccurrence,
    deleteRoutine,
    createRoutineCategory,
    updateRoutineCategory,
    deleteRoutineCategory,
    reorderCategories,
  } = data;
  const { toggleWithMissionGuard, houseCategoryIds, addRoutineWithMission } = missionLinks;

  // 재화 증감 이력 (#734) — 지갑 필 탭 시트. 시트가 열릴 때 load.
  const walletHistory = useWalletHistory();

  // 루틴 수동 순서 (#716) — 기기 로컬 보관, 방 '오늘' 리스트에 적용.
  const { order: routineOrder, reorder: reorderRoutines } = useRoutineOrder();
  // 드래그로 다른 카테고리에 드롭 = 영구 이동(서버 categoryId 변경).
  const moveRoutineCategory = useCallback(
    (id: string, toCategoryId: string) => {
      void moveRoutineToCategory(id, toCategoryId);
    },
    [moveRoutineToCategory],
  );

  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);

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

  // 푸시 탭(콜드 스타트 포함) → 알림 목록으로 (#405).
  useEffect(
    () =>
      onNotificationTap(() => {
        track('push_open');
        void loadNotifications();
        setScreen('notificationList');
      }),
    [loadNotifications, setScreen],
  );

  const openEditRoutine = useCallback(
    (routine: Routine, from: Screen) => {
      setEditingRoutine(routine);
      setAddReturnScreen(from);
      setScreen('addRoutine');
    },
    [setAddReturnScreen, setScreen],
  );

  // --- memo 화면(MyRoomScreen)으로 가는 콜백/파생 prop (#539) ---
  // 인라인 화살표·렌더마다 새로 만드는 객체는 memo 경계를 무효화한다. 매 렌더
  // 마운트되지 않는 서브화면 4종은 인라인을 유지한다.
  const openDecor = useCallback(() => setScreen('decor'), [setScreen]);
  const openRoutineManage = useCallback(() => setScreen('routineManage'), [setScreen]);
  const openCategoryManage = useCallback(() => setScreen('categoryManage'), [setScreen]);
  const openGacha = useCallback(() => setScreen('gacha'), [setScreen]);
  const openMyRoom = useCallback(() => setScreen('myRoom'), [setScreen]);
  const openNotificationList = useCallback(() => {
    void loadNotifications();
    setScreen('notificationList');
  }, [loadNotifications, setScreen]);
  // + 버튼은 바로 추가 화면으로 — 뒤로 가면 나의 방으로 복귀 (#335).
  const addRoutineFromMyRoom = useCallback(() => {
    setEditingRoutine(null);
    setAddReturnScreen('myRoom');
    setScreen('addRoutine');
  }, [setAddReturnScreen, setScreen]);
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
  // 당겨서 새로고침 (#454) — 실패해도 조용히 접는다(훅이 상태를 유지하고,
  // 인디케이터는 어차피 되돌아간다). 나의 방은 전체 리페치.
  const refreshMyRoom = useCallback(async () => {
    try {
      await reloadMyRoom();
    } catch {
      // 유지 — 기존 데이터가 그대로 남는다.
    }
  }, [reloadMyRoom]);
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

  /** 탭 페이저의 나의 방 페이지 prop — `<MyRoomScreen {...tabProps} />`. */
  const tabProps = {
    userName: nickname,
    streakDays: streak,
    coinBalance: wallet.coin,
    diamondBalance: wallet.diamond,
    routines,
    completions,
    categories,
    allCategories,
    calendarDays,
    onSelectDate: handleSelectDate,
    onToggleCalendarItem: handleToggleCalendarItem,
    loading: myRoomLoading,
    loadError: !!myRoomError,
    onRetry: retryMyRoom,
    placedFurnitureIds: room.placedFurnitureIds,
    placements: room.placements,
    wallpaperId: room.wallpaperId,
    floorId: room.floorId,
    backgroundId: room.backgroundId,
    furniture: room.catalogue.furniture,
    wallpapers: room.catalogue.wallpapers,
    floors: room.catalogue.floors,
    backgrounds: room.catalogue.backgrounds,
    characterId: character.wornCharacterId,
    characterFrames: character.wornCharacterFrames,
    onToggleCompletion: toggleWithMissionGuard,
    onEdit: openDecor,
    onAddRoutine: addRoutineFromMyRoom,
    onManageRoutines: openRoutineManage,
    onOpenNotifications: openNotificationList,
    unreadNotificationCount: unreadCount,
    // MVP 고양이 단일 (#637) — 미배선이면 캐릭터 교체 항목이 숨는
    // 기존 계약(#260)을 그대로 쓴다. 시트·훅 코드는 재사용 대기.
    ownedCharacters: CHARACTER_SELECTION_ENABLED ? character.ownedCharacters : undefined,
    onSelectCharacter: CHARACTER_SELECTION_ENABLED ? character.wearCharacter : undefined,
    onManageCategories: openCategoryManage,
    onUpdateCategory: updateRoutineCategory,
    onOpenGacha: openGacha,
    onRefresh: refreshMyRoom,
    onQuickAddRoutine: quickAddTodo,
    quickAddDisabledCategoryIds: houseCategoryIds,
    onRenameRoutine: renameRoutine,
    onEditRoutine: editRoutineFromMyRoom,
    onUpdateRoutineTime: updateRoutineTime,
    onUpdateTodoDueDate: updateTodoDueDate,
    onMoveRoutineOccurrence: moveRoutineOccurrence,
    onDeleteRoutine: deleteRoutine,
    routineOrder,
    onReorderRoutines: reorderRoutines,
    onMoveRoutineCategory: moveRoutineCategory,
    walletHistory: walletHistory.entries,
    walletHistoryLoading: walletHistory.loading,
    walletHistoryError: walletHistory.error,
    walletHistoryHasNext: walletHistory.hasNext,
    onLoadWalletHistory: walletHistory.load,
    onLoadMoreWalletHistory: walletHistory.loadMore,
  };

  /** 현재 화면이 나의 방 서브화면 4종이면 그 JSX, 아니면 null — 셸이 그대로 렌더. */
  const subScreen =
    screen === 'routineManage' ? (
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
    ) : screen === 'addRoutine' ? (
      <AddRoutineScreen
        categories={categories}
        editRoutine={editingRoutine}
        onAdd={addRoutineWithMission}
        onUpdate={updateRoutine}
        onDelete={deleteRoutine}
        onCreateCategory={createRoutineCategory}
        onBack={() => setScreen(addReturnScreen)}
      />
    ) : screen === 'categoryManage' ? (
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
    ) : screen === 'notificationList' ? (
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
    ) : null;

  return {
    tabProps,
    subScreen,
    /** 집 화면 '내 방으로' — 셸의 HouseScreen prop으로 흘러간다. */
    openMyRoom,
    /** 미션 배너 '루틴 등록하러 가기' — 셸의 openMissionScreen이 쓴다. */
    addRoutineFromMyRoom,
  };
}
