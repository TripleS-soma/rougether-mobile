import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { NAV_ORDER, SCREEN_FOR_TAB, type Screen } from '@/components/app/navigation';
import { TabPager } from '@/components/app/tab-pager';
import { useAppNavigation } from '@/components/app/use-app-navigation';
import { useFriendVisit } from '@/components/app/use-friend-visit';
import { useHousePages } from '@/components/app/use-house-pages';
import { useMissionLinks } from '@/components/app/use-mission-links';
import { useMyRoomPages } from '@/components/app/use-my-room-pages';
import { useSettingsSurface } from '@/components/app/use-settings-surface';
import { GachaScreen } from '@/components/screens/gacha-screen';
import { HouseScreen } from '@/components/screens/house-screen';
import { isScheduledOn, MyRoomScreen } from '@/components/screens/my-room-screen';
import {
  type DecorTab,
  dominantDecorTab,
  RoomDecorScreen,
} from '@/components/screens/room-decor-screen';
import { useLatestRef, useStableCallback } from '@/hooks/use-stable-value';
import { MyPageScreen } from '@/components/screens/my-page-screen';
import { AttendanceSheet } from '@/components/screens/sheets/attendance-sheet';
import { WalletHistorySheet } from '@/components/screens/sheets/wallet-history-sheet';
import { MissionSheet } from '@/components/screens/sheets/mission-sheet';
import { BottomNav } from '@/components/ui/bottom-nav';
import { MissionBanner } from '@/components/ui/mission-banner';
import { NotificationBanner } from '@/components/ui/notification-banner';
import { DEFAULT_CHARACTER_ID, type CharacterId } from '@/constants/characters';
import { screenView, track } from '@/lib/analytics';
import { todayIso } from '@/utils/datetime';
import { refreshWidgets } from '@/widgets/rougether-widgets';
import { buildWidgetSummary, saveWidgetSummary, saveWidgetTheme } from '@/widgets/widget-data';
import { useAttendance } from '@/hooks/use-attendance';
import { useWalletHistory } from '@/hooks/use-wallet-history';
import { useGacha } from '@/hooks/use-gacha';
import {
  type OnboardingMissionStepId,
  useOnboardingMissions,
} from '@/hooks/use-onboarding-missions';
import { useHouses } from '@/hooks/use-houses';
import { useRoomLayouts } from '@/hooks/use-room-layouts';
import { useMyCharacters } from '@/hooks/use-my-characters';
import { useMyRoomData } from '@/hooks/use-my-room-data';
import { useMemberRoomPreviews } from '@/hooks/use-member-room-previews';
import { useShop } from '@/hooks/use-shop';
import { useResolvedScheme } from '@/hooks/use-tokens';
import type { DrawResult } from '@/api';
import { fetchGachaRewards } from '@/api';
import { DEFAULT_WALLPAPER_ID, type PlacedFurniture } from '@/resources/furniture';
import { usePagerLock } from '@/components/app/use-pager-lock';
import { useTabScroll } from '@/components/app/use-tab-scroll';

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
  /**
   * 미션 배너에 건너뛰기를 노출할지 (#1023) — 설정 → '튜토리얼 다시 보기'로
   * 다시 돈 체인에서만 켠다. 첫 실행에는 출구를 두지 않는다.
   */
  missionSkipEnabled?: boolean;
  /**
   * 마스터 `/characters` 프레임 맵. 친구 방이 친구 캐릭터를 **내 방과 같은 그림**으로
   * 그리는 데 쓴다 (#968) — 친구 방 응답에는 `poses[]`가 없어 앱이 가진 마스터가
   * 유일한 출처다. 루트가 이미 받아둔 값이라 추가 요청은 없다.
   */
  characterFrames?: Partial<Record<CharacterId, string[]>>;
};

/** 프레임 맵 기본값 — 인라인 `{}`은 매 렌더 새 객체라 소비자의 메모가 깨진다. */
const NO_CHARACTER_FRAMES: Partial<Record<CharacterId, string[]>> = {};

/** 각 미션의 진입 화면 (#571) — 배너 탭·완료 시트 '하러 가기'의 목적지. */
const MISSION_TARGET_SCREEN: Record<OnboardingMissionStepId, Screen> = {
  'register-routine': 'addRoutine',
  'first-draw': 'gacha',
  'place-furniture': 'decor',
  'invite-house': 'houseMembers',
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
  missionSkipEnabled = false,
  characterFrames = NO_CHARACTER_FRAMES,
}: AppShellProps) {
  // 집 하늘 연출용 현재 비 여부 (#360) — 서울 고정, 30분 캐시.
  // 위젯에 넘길 실효 라이트/다크 (#746) — 앱 테마 모드 설정이 적용된 값.
  const resolvedScheme = useResolvedScheme();
  const [screen, setScreen] = useState<Screen>('myRoom');
  // Remember where the add/edit-routine screen was opened from, so its back
  // button returns to the right place (my-room or routine manage).
  const [addReturnScreen, setAddReturnScreen] = useState<Screen>('routineManage');
  // 마이페이지 → 주간회고 (#1056 → #1088): 연 곳으로 되돌아오게 addReturnScreen을 함께 세팅.
  const openWeeklyReportFromMyPage = useCallback(() => {
    setAddReturnScreen('myPage');
    setScreen('weeklyReport');
  }, []);

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

  // 연속 출석 이벤트 (#851) — 진행 중인 이벤트가 없으면 status가 null이라
  // 마이페이지 바로가기도 시트도 그려지지 않는다(#1089). 출석 코인은 응답의
  // 잔액으로 지갑을 맞춘다(뽑기·상점과 같은 결).
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const syncCoin = useCallback((coin: number) => setWallet((w) => ({ ...w, coin })), [setWallet]);
  const attendance = useAttendance({ onCoinBalance: syncCoin });
  const openAttendance = useCallback(() => setAttendanceOpen(true), []);
  // 오늘 미출석 — 마이페이지 타일·하단 탭 배지 (#1089). 이벤트가 없으면 false.
  const attendancePending = !!attendance.status && !attendance.status.checkedInToday;

  // 재화 내역 시트 (#734 → #1089) — 나의 방 메뉴에서 마이페이지 바로가기로.
  // 열 때마다 1페이지 재로드(완료 취소로 이력이 지워질 수 있음).
  const walletHistory = useWalletHistory();
  const [walletHistoryOpen, setWalletHistoryOpen] = useState(false);
  const { load: loadWalletHistory } = walletHistory;
  const openWalletHistory = useCallback(() => {
    setWalletHistoryOpen(true);
    loadWalletHistory();
  }, [loadWalletHistory]);

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
    selectedCharacterFrames: wornCharacterFrames,
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
  // 전체 객체는 use-house-pages(집 탭·서브화면 배선, #692 6단계)로 흘러가고,
  // 셸은 교차 도메인 소비자(자리 배치·미션 연동·친구 방문)가 쓰는 조각만
  // 여기서 푼다.
  const housesData = useHouses();
  const {
    houses,
    loading: housesLoading,
    contributedMissionIds,
    cheerMember,
    leaveHouse,
    applyMissionContribution,
    deleteMission,
  } = housesData;

  // Locally saved tile arrangements (#278) — the 집 화면 shows arranged houses
  // and drag-and-drop swaps persist per viewer+house on this device.
  const { houses: arrangedHouses, swapSeats } = useRoomLayouts(houses);

  // Which house the 집 switcher is on — kept here because HouseScreen
  // unmounts while visiting a friend's room and must reopen on the same house.
  // 상태는 셸 소유 (#692 6단계) — 미션 연동(현재 집)·친구 방문(스와이프 순회)
  // 이 use-house-pages보다 먼저 서서 소비하므로 훅으로 못 내린다.
  const [houseIndex, setHouseIndex] = useState(0);
  const currentHouse = houses[houseIndex] ?? houses[0];

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
    cleanCobweb,
    refreshOwned,
    saveLayout,
  } = useShop(setWallet);

  const [placedItems, setPlacedItems] = useState<PlacedFurniture[]>([]);
  const [wallpaperId, setWallpaperId] = useState(DEFAULT_WALLPAPER_ID);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [backgroundId, setBackgroundId] = useState<string | null>(null);
  useEffect(() => {
    setPlacedItems(placement.items);
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
  /** 뽑기에서 넘어올 때 열 종류 탭 (#897) — 그 외 경로는 기본 탭. */
  const [decorInitialTab, setDecorInitialTab] = useState<DecorTab | undefined>(undefined);
  /**
   * 뽑기 → '가구 배치하러 가기' (#630). 하이라이트만으로는 부족하다 (#897):
   * 벽지를 뽑았는데 가구 탭이 열려 있으면 표시가 안 보이는 탭에 있다.
   * 뽑은 게 가장 많은 종류의 탭을 함께 열어준다.
   */
  // 참조 고정 (#794 결) — catalogue를 deps에 넣으면 상점 구매 때마다 이
  // 콜백이 재생성된다. useStableCallback은 최신 catalogue를 읽으면서 참조는
  // 유지한다.
  const goPlaceDrawn = useStableCallback((results: DrawResult[]) => {
    const ids = results.map((r) => String(r.itemId)).filter(Boolean);
    setNewDecorItemIds(ids);
    setDecorInitialTab(dominantDecorTab(ids, catalogue));
    setScreen('decor');
  });
  // 진입 시점의 값만 필요하고 의존성에 넣으면 화면 안에서 목록이 비워질 때
  // 이펙트가 다시 돌므로 최신값 ref로 읽는다.
  const fromGachaRef = useLatestRef(newDecorItemIds.length > 0);
  useEffect(() => {
    if (screen === 'decor') {
      // 꾸미기 퍼널의 첫 단계 (#1043) — 진입 경로 셋(나의 방·뽑기·미션)이 전부
      // 이 상태 전환을 지나므로 여기서 한 번만 센다. 뽑기에서 온 경우만 구분.
      track('decor_open', { from: fromGachaRef.current ? 'gacha' : 'direct' });
    }
    if (screen !== 'decor') {
      setNewDecorItemIds([]);
      // 다음에 꾸미기를 직접 열면 기본 탭이어야 한다 — 뽑기에서 온 게 아니다.
      setDecorInitialTab(undefined);
    }
  }, [screen]);

  // 공동미션 ↔ 내 루틴 연동 (#272 → #578) — use-mission-links.ts로 이관 (#692 3단계).
  const {
    addMissionRoutine,
    houseCategoryIds,
    houseLinkedRoutines,
    contributedMissionIdList,
    deleteMissionWithLinked,
    removeMissionRoutine,
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

  /**
   * Profile + settings — **사본을 두지 않는다** (#924).
   *
   * 예전엔 셸이 `useState('준서')`로 별도 사본을 들고 API 값으로 seed했다.
   * 같은 값이 두 군데 살면서 화면마다 다른 걸 보게 됐고, 하드코딩된 남의
   * 이름이 로딩 구간에 노출됐다(온보딩에서 한 번 데었던 그 문제 —
   * onboarding-screen의 주석 참고). `saveProfile`이 이미 낙관적으로
   * 갱신하므로 사본 없이 그대로 파생하면 된다.
   */
  const nickname = apiNickname ?? '';
  const bio = apiBio ?? '';
  // 마이페이지·설정 서피스 (#692 2단계 → #1088) — 마이페이지 탭·서브화면 9종의 훅·콜백·JSX 소유.
  const handleProfileSave = useCallback(
    // saveProfile이 낙관적으로 상태를 바꾸고 실패 시 되돌린다 — 여기서 또
    // 손대면 되돌리기가 어긋난다 (#924). 집 좌석 라벨만은 별도 캐시(서버
    // 멤버 목록)에 살아서 재조회 없이 따로 파생해줘야 한다.
    (nick: string, b: string) => {
      void saveProfile(nick, b);
      housesData.applyMyNickname(nick);
    },
    [saveProfile, housesData],
  );
  const settingsSurface = useSettingsSurface({
    screen,
    setScreen,
    onReplayOnboarding,
    // 주간회고 다시 보기 (#1056) — 데이터는 나의 방 페이지 훅 소유. 훅 순서상
    // myRoomPages가 뒤에 오므로 setScreen 기반의 안정 콜백으로 연결한다.
    onOpenWeeklyReport: openWeeklyReportFromMyPage,
    profile: {
      nickname,
      bio,
      characterId: wornCharacterId,
      characterFrames: wornCharacterFrames,
      onSave: handleProfileSave,
    },
    stats: { streak, coin: wallet.coin, diamond: wallet.diamond },
    // 바로가기 (#1089) — 출석은 이벤트가 있을 때만 배선(없으면 타일이 숨는다).
    shortcuts: {
      onOpenAttendance: attendance.status ? openAttendance : undefined,
      attendancePending,
      onOpenWalletHistory: openWalletHistory,
    },
  });
  // 나의 방 페이지 배선 (#692 5단계) — 나의 방 탭 페이지와 서브화면 4종
  // (루틴 관리·추가·카테고리 관리·알림 목록)의 훅·콜백·JSX 소유.
  const myRoomPages = useMyRoomPages({
    nav: { screen, setScreen, addReturnScreen, setAddReturnScreen },
    data: myRoomData,
    nickname,
    missionLinks: { toggleWithMissionGuard, houseCategoryIds, addRoutineWithMission },
    character: { wornCharacterId, wornCharacterFrames, ownedCharacters, wearCharacter },
    room: {
      placements: placedItems,
      wallpaperId,
      floorId,
      backgroundId,
      catalogue,
      cobweb: placement.cobweb,
      onCleanCobweb: cleanCobweb,
      markedTodoDates: myRoomData.markedTodoDates,
      onCalendarMonthChange: myRoomData.loadCalendarMonth,
    },
  });
  // 홈 위젯 오늘 요약 동기화 (#604, 안드로이드 전용) — 완료 토글·루틴
  // 변경·스트릭 갱신이 위젯에 바로 반영되게 요약을 기록하고 재렌더를 민다.
  // 위젯 다크모드 동기화 (#746) — 앱의 테마 모드('system'|'light'|'dark')가
  // 적용된 실효 스킴을 위젯 저장소에 기록한다. 위젯은 시스템 설정만 볼 수
  // 있어, 앱에서 다크로 바꿔도 위젯이 라이트로 남던 불일치를 없앤다.
  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    void saveWidgetTheme(resolvedScheme === 'dark').then(refreshWidgets);
  }, [resolvedScheme]);

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

  // 멤버 방 프리뷰 (#775) — 집 좌석 타일과 친구 방문이 함께 쓴다. 훅 호출이
  // use-house-pages 안에 있으면 그보다 먼저 서는 use-friend-visit이 거미줄
  // 청소 후 타일을 갱신할 방법이 없어(#831) 셸로 끌어올렸다.
  const memberRoomPreviews = useMemberRoomPreviews();

  // 친구 방문 클러스터 (#149·#644) — use-friend-visit.tsx로 이관 (#692 4단계).
  const { visitFriend, subScreen: friendRoomSubScreen } = useFriendVisit({
    setScreen,
    catalogue,
    characterFrames,
    arrangedHouses,
    houseIndex,
    screen,
    cheerMember,
    clearPreviewCobweb: memberRoomPreviews.clearCobweb,
  });

  // Android hardware back navigates the shell's own screen stack; 루트(나의 방)
  // 에서는 바로 끄지 않고 더블 백으로 종료한다 (#522) — 첫 입력은 토스트
  // 안내, EXIT_WINDOW 안에 한 번 더 누르면 종료. (iOS는 시스템 종료
  // 뒤로가기가 없고 코드 종료도 금지라 해당 경로 자체가 없다.)
  // --- 하단 탭 수평 페이저 (#563) ---
  // 집 화면이 확대·자리 드래그로 제스처 전권을 가져간 동안 페이저를 잠근다.
  // 단 집 "페이지가 활성일 때만" — 확대를 남겨둔 채 탭 버튼으로 떠났을 때
  // 다른 페이지의 스와이프까지 막으면 안 된다. TabPager·내비와 결합된 셸
  // 잔류 클러스터 (#692 6단계) — 잠금 콜백만 집 페이지 prop으로 내려간다.
  const { lock: pagerLock, setHouseLocked: handleHousePagerLock } = usePagerLock(screen);
  // 탭별 스크롤 위치 (#763) — 서브화면에서 페이저가 언마운트돼도 셸이 기억한다.
  const tabScroll = useTabScroll();

  // 집 페이지 배선 (#692 6단계) — 집 탭 페이지와 서브화면 2종(집 탐색·집
  // 생성)의 훅·콜백·JSX 소유. noHouses 판정·탐색 이탈 미션 판정을 반환해
  // 아래 내비 훅·BottomNav로 흘린다.
  const housePages = useHousePages({
    nav: { screen, setScreen },
    data: housesData,
    houseIndex,
    setHouseIndex,
    currentHouse,
    arranged: { arrangedHouses, swapSeats },
    missionLinks: {
      leaveHouseWithLinked,
      deleteMissionWithLinked,
      removeMissionRoutine,
      addMissionRoutine,
      houseLinkedRoutines,
      contributedMissionIdList,
    },
    visitFriend,
    openMyRoom: myRoomPages.openMyRoom,
    completeMission,
    catalogue,
    shopLoading,
    wallet,
    nickname,
    streak,
    selectedCharacterId,
    wornCharacterId,
    onPagerLockChange: handleHousePagerLock,
    roomPreviewStore: memberRoomPreviews,
  });

  // 내비게이션 컨트롤러 (#692) — 뒤로가기·엣지 백·전환 손맛·페이저 정착.
  // noHouses·탐색 이탈 판정이 use-house-pages 반환값이라 훅 호출이 그 뒤에 선다.
  const { edgeBackPan, activeTab, handlePageChange, transOpacity, transX } = useAppNavigation({
    screen,
    setScreen,
    addReturnScreen,
    noHouses: housePages.noHouses,
  });

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
              <MyRoomScreen {...myRoomPages.tabProps} {...tabScroll.myRoom} />
              <HouseScreen {...housePages.tabProps} {...tabScroll.house} />
              <MyPageScreen {...settingsSurface.myPageProps} {...tabScroll.myPage} />
            </TabPager>
          ) : null}

          {screen === 'decor' ? (
            <RoomDecorScreen
              initialItems={placedItems}
              highlightItemIds={newDecorItemIds}
              initialTab={decorInitialTab}
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
              characterFrames={wornCharacterFrames}
              // 일괄 구매(프리뷰 저장, #501)가 결과를 기다린다 — Promise를 그대로.
              onBuy={(itemId) => purchaseFurniture(itemId)}
              onApply={async (its, wp, fl, bg) => {
                const result = await saveLayout(its, wp, fl, bg);
                if (result === 'ok') {
                  setPlacedItems(its);
                  setWallpaperId(wp);
                  setFloorId(fl);
                  setBackgroundId(bg);
                  // 꾸미기 저장 성공 = 미션 3 완료 (#571) — 새 아이템 포함
                  // 여부는 따지지 않는다(사양 단순화).
                  // 퍼널 마지막 칸 (#799) — 루틴→코인→뽑기→꾸미기 한 바퀴가
                  // 닫힌 지점. 미션은 스킵 가능하므로 저장 자체를 센다.
                  track('room_save', { item_count: its.length });
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

          {/* 집 서브화면 2종 (#692 6단계) — use-house-pages가 그린다. */}
          {housePages.subScreen}

          {/* 마이페이지 서브화면 9종(설정 포함, #692 → #1088) — use-settings-surface가 그린다. */}
          {settingsSurface.subScreen}
        </Animated.View>
      </GestureDetector>

      {activeTab ? (
        <BottomNav
          active={activeTab}
          // 미출석 점은 방 메뉴 버튼에서 마이페이지 탭으로 (#1089).
          badges={attendancePending ? MY_PAGE_BADGE : undefined}
          onChange={(tab) =>
            // 집이 없으면 집 탭은 빈 상태 대신 집 탐색으로 직행 (#571).
            setScreen(tab === 'house' && housePages.noHouses ? 'houseSearch' : SCREEN_FOR_TAB[tab])
          }
        />
      ) : null}

      {/* 인앱 푸시 배너 (#902) — 앱이 켜져 있을 때 도착한 알림. 미션 배너와
          같은 상단 슬롯이지만 zIndex가 높아 잠깐 덮었다 5초 뒤 사라진다.
          key로 다시 마운트해야 연속 수신 때 애니메이션·타이머가 새로 돈다. */}
      {myRoomPages.pushBanner ? (
        <NotificationBanner
          key={myRoomPages.pushBanner.key}
          type={myRoomPages.pushBanner.type}
          title={myRoomPages.pushBanner.title}
          body={myRoomPages.pushBanner.body}
          onPress={myRoomPages.pushBanner.onPress ?? myRoomPages.openNotifications}
          onDismiss={myRoomPages.dismissPushBanner}
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
          canSkip={missionSkipEnabled}
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

      {/* 연속 출석 시트 (#851) — 이벤트가 있을 때만 존재한다. */}
      {attendance.status ? (
        <AttendanceSheet
          visible={attendanceOpen}
          status={attendance.status}
          checkingIn={attendance.checkingIn}
          onCheckIn={attendance.checkIn}
          onGoToRoom={() => {
            setAttendanceOpen(false);
            setScreen('decor');
          }}
          onClose={() => setAttendanceOpen(false)}
        />
      ) : null}

      {/* 재화 내역 시트 (#734 → #1089) — 마이페이지 바로가기가 연다. */}
      <WalletHistorySheet
        visible={walletHistoryOpen}
        onClose={() => setWalletHistoryOpen(false)}
        entries={walletHistory.entries}
        loading={walletHistory.loading}
        loadError={walletHistory.error}
        onRetry={walletHistory.load}
        hasNext={walletHistory.hasNext}
        onLoadMore={walletHistory.loadMore}
      />
    </View>
  );
}

// 참조 고정 — BottomNav prop이 렌더마다 새 객체면 memo 검증(#539)에 잡힌다.
const MY_PAGE_BADGE = { myPage: true } as const;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
