import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  type GestureResponderEvent,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { NavMenuPopover } from '@/components/app/nav-menu-popover';
import { FlyingCoin } from '@/components/ui/flying-coin';
import { isScheduledOn } from '@/components/screens/my-room/schedule';
import {
  type DragSlot,
  type DropTarget,
  isRejectedDrop,
  reorderedIds,
  resolveDrop,
} from '@/components/screens/my-room/routine-drag';
import { applyRoutineOrder } from '@/hooks/use-routine-order';
import {
  useAnimatedValue,
  useConstant,
  useLatestRef,
  useStableCallback,
} from '@/hooks/use-stable-value';
import type { WalletHistoryEntry } from '@/api/adapters';
import { QuickAddRow } from '@/components/screens/my-room/quick-add-row';
import { RoutineRow } from '@/components/screens/my-room/routine-row';
import { WalletHistorySheet } from '@/components/screens/sheets/wallet-history-sheet';
import { useWidgetRoomCapture } from '@/components/screens/my-room/use-widget-room-capture';
import { Room, type RoomSceneProps } from '@/components/room/room';
import {
  CharacterPickerSheet,
  type OwnedCharacter,
} from '@/components/screens/sheets/character-picker-sheet';
import { CategoryFormSheet } from '@/components/screens/sheets/category-form-sheet';
import { DateEditSheet } from '@/components/screens/sheets/date-edit-sheet';
import { RenameDialog } from '@/components/screens/sheets/rename-dialog';
import { RoutineMenuSheet } from '@/components/screens/sheets/routine-menu-sheet';
import { TimePickerSheet } from '@/components/screens/sheets/time-picker-sheet';
import { TodoDateDialog } from '@/components/screens/sheets/todo-date-dialog';
import { Loading } from '@/components/ui/loading';
import { Calendar } from '@/components/ui/calendar';
import { CoachTarget } from '@/components/ui/coach-mark';
import { GlassSurface } from '@/components/ui/glass-surface';
import { CategoryIcon } from '@/components/ui/category-icon';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import { Pictogram } from '@/components/ui/pictograms';
import { RetryState } from '@/components/ui/retry-state';
import { SpringProgressBar } from '@/components/ui/spring-progress';
import { useToast } from '@/components/ui/toast';
import { type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import {
  type CategoryVisibility,
  ROUTINE_CATEGORIES,
  type Routine,
  type RoutineCategoryMeta,
  UNCATEGORIZED_META,
  VISIBILITY_ICONS,
  VISIBILITY_LABELS,
} from '@/constants/routines';
import { Icon } from '@/components/ui/icon';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Radius, Spacing } from '@/constants/theme';
import { saveRoomImage } from '@/lib/room-capture';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';
import { useBottomNavInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { type ScrollRestoreProps, useScrollRestore } from '@/hooks/use-scroll-restore';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { readableTextColor } from '@/utils/color';
import { formatDate, todayIso } from '@/utils/datetime';
import { hapticSelection, hapticSuccess } from '@/utils/haptics';

// 스케줄 판정은 my-room/schedule로 이동 (#693) — 기존 임포트 경로 유지용 재수출.
export { isScheduledOn };

/**
 * One routine/todo on a calendar date (server GET /calendar). Non-today dates
 * are read-only — the server only accepts completion checks for today.
 */
export type CalendarDayItem = {
  id: string;
  kind: 'routine' | 'todo';
  title: string;
  time?: string;
  completed: boolean;
  /** Category id at record time — may reference a deleted category. */
  category?: string;
};

// 떠 있는 크롬 (#1055) — 이름 알약·세그먼트 한 줄의 높이. 달력 탭의 콘텐츠 상단
// 패딩과 보상 알약 위치가 같은 값을 본다.
const CHROME_ROW_HEIGHT = 40;
/** 보상 알약이 떠 있는 시간 — 코인 플라이(~600ms)가 도착하고 읽을 만큼. */
const REWARD_PILL_MS = 2200;
const ZERO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

// RoomSceneProps: <Room />에 스프레드로 전달되는 씬 번들 (#691) — 내 방은
// 캐릭터가 항상 있으므로 characterId만 null 불가로 좁힌다.
export type MyRoomScreenProps = Omit<RoomSceneProps, 'characterId'> &
  ScrollRestoreProps & {
    /**
     * 거미줄 청소 (#830) — 성공하면 받은 코인 수, 실패·중복이면 null.
     * 화면은 그 값으로만 코인 연출을 쏜다(중복 청소에 보상 연출이 뜨면 거짓말).
     */
    onCleanCobweb?: () => Promise<number | null>;
    /** 할 일 있는 날 (#838) — 달력 점 표시. 없으면 점 없이 그린다. */
    markedTodoDates?: ReadonlySet<string>;
    /** 달력에서 보이는 달이 바뀔 때 (#838) — 부모가 그 달 개수를 받아온다. */
    onCalendarMonthChange?: (yearMonth: string) => void;
    /**
     * 연속 출석 이벤트 (#851) — 진행 중인 이벤트가 없으면 undefined로 두면
     * 헤더 아이콘 자체가 그려지지 않는다.
     */
    attendance?: {
      /** 오늘 아직 출석 안 했는지 — 아이콘에 빨간 점. */
      pending: boolean;
    };
    /** 출석 아이콘 탭 — 셸이 출석 시트를 연다. */
    onOpenAttendance?: () => void;

    /** Room occupant's display name (header title becomes "{userName}의 방"). */
    userName?: string;
    /** Consecutive-day streak shown in the header. */
    streakDays?: number;
    /** Wallet balances shown in the header (완료 보상 피드백의 기준점). */
    coinBalance?: number;
    diamondBalance?: number;
    characterId?: CharacterId;
    // Routine list.
    routines?: Routine[];
    /**
     * All categories including server-deleted ones — resolves the original
     * name/color of past records in the 달력 tab. Defaults to `categories`.
     */
    allCategories?: RoutineCategoryMeta[];
    /**
     * Server-backed 달력 data per date (from GET /calendar). When wired together
     * with onSelectDate, non-today dates render this read-only list; a missing
     * date means "loading".
     */
    calendarDays?: Record<string, CalendarDayItem[]>;
    /** Load a date's calendar data (fired when the user picks a date). */
    onSelectDate?: (date: string) => void;
    /**
     * Toggle a server-backed 달력 item's completion on a past date. Only fired
     * for past todos — the screen blocks future dates and past routines (the
     * server accepts routine logs for today only) with a toast.
     */
    onToggleCalendarItem?: (item: CalendarDayItem, date: string) => void;
    /**
     * Per-routine completion log: routine id → completed dates ("YYYY-MM-DD").
     * Mirrors the spec's routine_logs; a routine is "done" on a date when that
     * date is present here.
     */
    completions?: Record<string, string[]>;
    categories?: RoutineCategoryMeta[];
    /** True while the routine/category data is loading (shows a spinner). */
    loading?: boolean;
    /** True when the initial load failed (shows an error + 다시 시도). */
    loadError?: boolean;
    /** Re-run the failed load (다시 시도 button). */
    onRetry?: () => void;
    // Callbacks (wired separately).
    onEdit?: () => void;
    /** 오늘의 루틴 + 버튼 — 바로 루틴 추가 화면으로 (#335). */
    onAddRoutine?: () => void;
    /** 햄버거 메뉴의 루틴 관리 항목 (없으면 onAddRoutine으로 폴백). */
    onManageRoutines?: () => void;
    /** Open the 알림 list (햄버거 메뉴 항목; hidden when unwired). */
    onOpenNotifications?: () => void;
    /** Unread notification count — >0 shows a dot on the menu button + item. */
    unreadNotificationCount?: number;
    /** Owned characters (햄버거 메뉴 → 캐릭터 교체 sheet; hidden when unwired). */
    ownedCharacters?: OwnedCharacter[];
    /** Wear the picked character (PUT /me/characters/select). */
    onSelectCharacter?: (serverId: number) => void;
    /** 햄버거 메뉴 → 카테고리 관리 화면으로 이동 (#394). */
    onManageCategories?: () => void;
    /** 카테고리 헤더 탭 → 해당 카테고리 수정 시트 저장 (#541). 없으면 헤더 탭 비활성. */
    onUpdateCategory?: (id: string, category: RoutineCategoryMeta) => void;
    /** Toggle a routine's completion on a specific date ("YYYY-MM-DD"). */
    /** 완료 토글 — 완료 시 서버 보상액(코인)을 resolve하면 코인 연출에 쓴다 (#444). */
    onToggleCompletion?: (
      id: string,
      date: string,
    ) => void | Promise<{ rewardAmount: number } | null | undefined>;
    onOpenGacha?: () => void;
    /** 당겨서 새로고침 (#454) — 서버 데이터 전체 리로드. resolve까지 발바닥이 두근거린다. */
    onRefresh?: () => Promise<void> | void;
    /** Quick-add a todo to a category with a due date (the + on a category header). */
    onQuickAddRoutine?: (category: string, title: string, dueDate: string) => void;
    /**
     * Categories whose quick-add(+) is hidden — 공동미션 연동 카테고리는 미션의
     * + 버튼으로만 항목이 생겨야 하므로 임의 투두 추가를 막는다 (#272).
     */
    quickAddDisabledCategoryIds?: string[];
    /** Rename a routine (메뉴 시트 → 이름 변경: name only). */
    onRenameRoutine?: (id: string, title: string) => void;
    /** Full-edit a routine (메뉴 시트 → 루틴 수정): opens the routine editor (#465). */
    onEditRoutine?: (routine: Routine) => void;
    /** Update a routine's alarm time (kebab → 시간 수정, reuses TimePickerSheet). */
    onUpdateRoutineTime?: (id: string, alarmEnabled: boolean, time: string) => void;
    /** Change a todo's due date (메뉴 시트 → 날짜 바꾸기, calendar sheet). */
    onUpdateTodoDueDate?: (id: string, dueDate: string) => void;
    /**
     * 날짜 바꾸기 on a routine: move that day's occurrence only. The repeat
     * schedule stays; a one-off todo with the routine's title is created on the
     * picked date (no server per-occurrence skip yet, so the original day's
     * instance still shows — the sheet says so).
     */
    onMoveRoutineOccurrence?: (id: string, dueDate: string) => void;
    /** Delete a routine (kebab → 삭제). */
    onDeleteRoutine?: (id: string) => void;
    /**
     * 수동 순서 맵 (#716) — `{ [categoryId]: [routineId...] }`. 방 '오늘' 리스트의
     * 미완료 항목을 이 순서로 정렬한다(완료는 기존대로 하단). 기기 로컬 보관.
     */
    routineOrder?: Record<string, string[]>;
    /** 롱프레스 재정렬 확정 — 해당 카테고리의 새 루틴 id 순서(미완료 기준). */
    onReorderRoutines?: (categoryId: string, orderedRoutineIds: string[]) => void;
    /** 다른 카테고리로 드롭 = 영구 이동 (#716) — 서버 categoryId 변경. */
    onMoveRoutineCategory?: (id: string, toCategoryId: string) => void;
    /** 재화 내역 (#734) — 지갑 필 탭 → 시트. 열 때마다 onLoadWalletHistory로 재로드. */
    walletHistory?: WalletHistoryEntry[];
    walletHistoryLoading?: boolean;
    walletHistoryError?: boolean;
    walletHistoryHasNext?: boolean;
    onLoadWalletHistory?: () => void;
    onLoadMoreWalletHistory?: () => void;
  };

/**
 * "My room" (zoomed) screen, ported from the prototype `MyRoomZoomScreen`:
 * header (character + streak), the shared <Room /> view with a gacha shortcut,
 * today's routines grouped by category with a progress bar. Each category
 * header has a + to quick-add a todo, and each routine has a kebab menu (수정 /
 * 삭제) shown as a small modal. Pure + prop-driven; the web-only "save room photo"
 * (SVG/canvas) is dropped. Spec domain: rougether-spec domains/room.
 */
/**
 * 카테고리명 옆 공개범위 픽토그램(#285) — 관리 시트를 열지 않아도 각
 * 카테고리의 노출 범위(전체/이웃/일부/비공개)가 헤더에서 읽힌다.
 */
function VisibilityMark({ visibility }: { visibility: CategoryVisibility }) {
  const t = useTokens();
  return (
    <View accessible accessibilityLabel={VISIBILITY_LABELS[visibility]}>
      <Pictogram name={VISIBILITY_ICONS[visibility]} size={12} color={t.textMuted} />
    </View>
  );
}

// memo 경계 (#539): 셸의 무관한 상태 변화에서 이 화면(그리고 안의 방 캔버스)
// 리렌더를 끊는다 — AppShell이 넘기는 함수/객체 prop의 참조 안정이 전제다.
export const MyRoomScreen = memo(function MyRoomScreen({
  userName = '',
  streakDays = 7,
  coinBalance = 0,
  diamondBalance = 0,
  characterId = DEFAULT_CHARACTER_ID,
  characterFrames,
  wallpaperId = DEFAULT_WALLPAPER_ID,
  floorId,
  backgroundId,
  cobweb,
  onCleanCobweb,
  markedTodoDates,
  onCalendarMonthChange,
  attendance,
  onOpenAttendance,
  placements = [],
  furniture,
  wallpapers,
  floors,
  backgrounds,
  routines = [],
  allCategories,
  calendarDays,
  onSelectDate,
  onToggleCalendarItem,
  completions = {},
  categories = ROUTINE_CATEGORIES,
  loading = false,
  loadError = false,
  onRetry,
  onEdit,
  onAddRoutine,
  onManageRoutines,
  onOpenNotifications,
  unreadNotificationCount = 0,
  ownedCharacters,
  onSelectCharacter,
  onManageCategories,
  onUpdateCategory,
  onToggleCompletion,
  onOpenGacha,
  onRefresh,
  onQuickAddRoutine,
  quickAddDisabledCategoryIds = [],
  onRenameRoutine,
  onEditRoutine,
  onUpdateRoutineTime,
  onUpdateTodoDueDate,
  onMoveRoutineOccurrence,
  onDeleteRoutine,
  routineOrder,
  onReorderRoutines,
  onMoveRoutineCategory,
  walletHistory,
  walletHistoryLoading = false,
  walletHistoryError = false,
  walletHistoryHasNext = false,
  onLoadWalletHistory,
  onLoadMoreWalletHistory,
  getInitialScrollY,
  onScrollY,
}: MyRoomScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  const Typography = useTypography();
  // 글래스 알약 바텀바가 떠 있으면 마지막 루틴이 그 밑에 안 숨게 (#1049).
  const navInset = useBottomNavInset();
  // 떠 있는 크롬(#1055)이 상태바 밑에 서지 않게 — 방은 상태바 밑까지 차지한다.
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  const { height: windowHeight } = useWindowDimensions();

  // 코인 플라이 (#440) — 완료 탭 지점에서 보상 알약(#1055)으로 포물선 비행.
  const rootRef = useRef<View>(null);
  const rewardPillRef = useRef<View>(null);
  const flyTarget = useRef({ x: 0, y: 0 });
  const rewardPulse = useAnimatedValue(1);
  const coinSeq = useRef(0);
  const [flyingCoins, setFlyingCoins] = useState<
    { id: number; x: number; y: number; tx: number; ty: number }[]
  >([]);
  // 보상 알약 (#1055) — 스트릭·코인은 상시 헤더가 아니라 보상이 확인된 순간에만
  // 방 위에 떠서 증분을 보여주고 REWARD_PILL_MS 뒤 사라진다. 표시 중 또 오면 합산.
  const [reward, setReward] = useState<{ coins: number } | null>(null);
  const rewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 알약이 아직 안 떠 있을 때 도착한 보상 — 알약이 그려져 위치가 측정되면 그때 쏜다.
  const pendingFly = useRef<{ x: number; y: number } | null>(null);
  useEffect(
    () => () => {
      if (rewardTimer.current) clearTimeout(rewardTimer.current);
    },
    [],
  );
  const launchCoinAt = ({ x: pageX, y: pageY }: { x: number; y: number }) => {
    rootRef.current?.measureInWindow((rx, ry) => {
      const target = flyTarget.current;
      if (!target.x && !target.y) return;
      const id = coinSeq.current++;
      setFlyingCoins((prev) => [
        ...prev,
        { id, x: pageX - rx, y: pageY - ry, tx: target.x - rx, ty: target.y - ry },
      ]);
    });
  };
  const showReward = (coins: number, from: { x: number; y: number } | null) => {
    setReward((prev) => ({ coins: (prev?.coins ?? 0) + coins }));
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
    rewardTimer.current = setTimeout(() => {
      setReward(null);
      flyTarget.current = { x: 0, y: 0 };
    }, REWARD_PILL_MS);
    if (!from) return;
    if (flyTarget.current.x || flyTarget.current.y) launchCoinAt(from);
    else pendingFly.current = from;
  };
  const measureRewardPill = () => {
    rewardPillRef.current?.measureInWindow((x, y, w, h) => {
      flyTarget.current = { x: x + w / 2, y: y + h / 2 };
      const from = pendingFly.current;
      if (from) {
        pendingFly.current = null;
        launchCoinAt(from);
      }
    });
  };
  // 거미줄 청소 (#830) — 보상이 실제로 지급됐을 때만 코인이 난다.
  const handleCleanCobweb = async (at: { x: number; y: number }) => {
    const earned = await onCleanCobweb?.();
    if (earned && earned > 0) showReward(earned, at);
  };

  const onCoinArrive = (id: number) => {
    setFlyingCoins((prev) => prev.filter((c) => c.id !== id));
    rewardPulse.setValue(1.18);
    Animated.spring(rewardPulse, { toValue: 1, friction: 3.5, useNativeDriver: true }).start();
  };

  // 스트릭 펄스 (#440) — 수치가 오르는 순간 🔥가 한 번 크게 일렁.
  const streakPulse = useAnimatedValue(1);
  const prevStreak = useRef(streakDays);
  useEffect(() => {
    if (streakDays > prevStreak.current) {
      streakPulse.setValue(1.5);
      Animated.spring(streakPulse, { toValue: 1, friction: 3, useNativeDriver: true }).start();
    }
    prevStreak.current = streakDays;
  }, [streakDays, streakPulse]);
  const { show: toast } = useToast();
  const knownIds = useMemo(() => categories.map((c) => c.id), [categories]);

  const today = todayIso();
  const isDone = useCallback(
    (id: string, date: string) => (completions[id] ?? []).includes(date),
    [completions],
  );
  // Checked items sink below unchecked ones within their category (stable in
  // each half), keeping the remaining work on top of every list.
  const sinkDone = useCallback(
    <T,>(items: T[], done: (item: T) => boolean): T[] => [
      ...items.filter((i) => !done(i)),
      ...items.filter(done),
    ],
    [],
  );
  // The 방 tab lists only what's scheduled *today* (repeat days + start/end
  // range) — the same rule the 달력 tab applies to its selected date. Without
  // this, editing a routine's days never changed the today list.
  const roomRoutines = useMemo(
    () => routines.filter((r) => isScheduledOn(r, today)),
    [routines, today],
  );
  const completedCount = roomRoutines.filter((r) => isDone(r.id, today)).length;
  const progress = roomRoutines.length > 0 ? completedCount / roomRoutines.length : 0;

  // Routines with a missing/unknown category land in the last group; with no
  // categories at all, render a single pseudo-group so they stay visible
  // (routines can exist without any category, e.g. after a category delete).
  // 미분류(카테고리 삭제 UNASSIGN 산물, #517)는 마지막 카테고리에 섞지 않고
  // 전용 '미분류' 그룹으로 맨 뒤에 붙인다. 완전 빈 계정도 미분류 그룹을
  // 세운다 (#626) — 첫 가입자가 카테고리 개념 없이도 그 자리에서 바로
  // 추가를 시작한다(퀵애드는 categoryId 없이 생성 → 고아 입양이 수렴).
  const roomGroups = useMemo(() => {
    const hasUncategorizedRoom = roomRoutines.some(
      (r) => !r.category || !knownIds.includes(r.category),
    );
    const metas =
      categories.length > 0
        ? [...categories, ...(hasUncategorizedRoom ? [UNCATEGORIZED_META] : [])]
        : [UNCATEGORIZED_META];
    return metas.map((cat) => {
      // 미분류 그룹(id '')이 무소속·미상 카테고리 항목을 받는다 (#517).
      const isUncategorized = cat.id === '';
      const inCat = roomRoutines.filter((r) => {
        if (r.category === cat.id) return true;
        return isUncategorized && (!r.category || !knownIds.includes(r.category));
      });
      // 수동 순서(#716)를 미완료 항목에 적용한 뒤 완료를 하단으로 가라앉힌다 —
      // 순서는 "내가 정한 미완료 배치"가 진실이고, 완료는 자동으로 밀린다.
      const items = sinkDone(applyRoutineOrder(inCat, routineOrder?.[cat.id]), (r) =>
        isDone(r.id, today),
      );
      return { meta: cat, items };
    });
  }, [categories, roomRoutines, knownIds, sinkDone, isDone, today, routineOrder]);

  // Header hamburger popover (방 꾸미기 / 카테고리 관리 / 루틴 관리) + the
  // category manager sheet it opens. The popover anchors under the measured
  // button position — a fixed offset misaligns across notch/status-bar sizes.
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [navMenuTop, setNavMenuTop] = useState(104);
  // 버튼이 방 오른쪽 아래로 내려가(#1055) 팝오버는 **남은 공간이 큰 쪽**으로 연다 —
  // 버튼이 화면 위쪽 절반이면 아래로, 아래쪽 절반이면 위로(bottom 앵커). 한쪽으로
  // 고정하면 6항목 팝오버가 상태바 위나 바텀바 아래로 잘린다(시뮬레이터 실측).
  // 측정이 안 되는 곳(테스트·웹)은 종전 top 폴백.
  const [navMenuBottom, setNavMenuBottom] = useState<number | undefined>(undefined);
  const menuBtnRef = useRef<View>(null);
  const [characterSheetOpen, setCharacterSheetOpen] = useState(false);
  // 재화 내역 시트 (#734) — 열 때마다 1페이지 재로드(완료 취소로 이력이 지워질 수 있음).
  const [walletHistoryOpen, setWalletHistoryOpen] = useState(false);
  const openWalletHistory = onLoadWalletHistory
    ? () => {
        setWalletHistoryOpen(true);
        onLoadWalletHistory();
      }
    : undefined;

  const openNavMenu = () => {
    setNavMenuOpen(true);
    // measureInWindow is a no-op in tests/web — the fallback top then applies.
    menuBtnRef.current?.measureInWindow?.((_x, y, _w, h) => {
      if (typeof y === 'number' && typeof h === 'number') {
        setNavMenuTop(y + h + Spacing.one);
        setNavMenuBottom(y > windowHeight / 2 ? windowHeight - y + Spacing.one : undefined);
      }
    });
  };

  // Which category's quick-add input is open, the in-progress todo text + due
  // date, and which routine's kebab menu is open.
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  // 입력 중인 제목은 QuickAddRow가 소유한다 (#769) — 여기 두면 한 글자마다
  // 화면 전체가 리렌더돼 전 행의 스와이프 트리·제스처까지 재조정된다.
  const [newTodoDate, setNewTodoDate] = useState(today);
  const [todoDateOpen, setTodoDateOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // 메뉴 시트의 날짜 문맥 — 방탭은 오늘, 달력탭은 선택한 날짜로 연다 (#323).
  const [menuDate, setMenuDate] = useState(today);
  const menuRoutine = routines.find((r) => r.id === menuOpenId) ?? null;
  const openRowMenu = (id: string, date = today) => {
    setMenuDate(date);
    setMenuOpenId(id);
  };

  // Kebab → 수정: rename only (the dialog holds the draft text). Kebab → 시간
  // 수정: TimePickerSheet.
  const [renameId, setRenameId] = useState<string | null>(null);
  // 헤더 탭으로 여는 카테고리 수정 시트의 대상 (#541).
  const [editingCategory, setEditingCategory] = useState<RoutineCategoryMeta | null>(null);
  const renameItem = routines.find((r) => r.id === renameId) ?? null;
  const [timeId, setTimeId] = useState<string | null>(null);
  const timeRoutine = routines.find((r) => r.id === timeId) ?? null;
  // 메뉴 → 날짜 바꾸기: calendar sheet. Todos move their dueDate; routines move
  // that day's occurrence only (repeat stays). The draft date lives in the sheet.
  const [dateEditId, setDateEditId] = useState<string | null>(null);
  const dateEditItem = routines.find((r) => r.id === dateEditId) ?? null;

  // 방 / 달력 tab. The calendar lists routines + todos on the selected date.
  // Today renders from live client state (toggleable); other dates render the
  // server /calendar list, where only past todos toggle — future dates can't
  // be completed, routines accept today-only logs server-side, and past
  // records keep their original (possibly deleted) category.
  // 방↔달력은 상단 탭 버튼으로만 오간다 (#825). 예전엔 방 캔버스·달력
  // 그리드 위 가로 플링이 두 서브탭을 순환시켰는데(#561), 그 아래 루틴
  // 리스트에서는 같은 손동작이 셸 탭 페이저(나의 방↔집)를 움직여서 —
  // 손가락 위치 몇십 px 차이로 결과가 갈렸다. 이제 이 화면의 가로
  // 스와이프는 전부 셸 탭 페이저 몫이고, 달력도 monthSwipe=false를
  // 유지해 가로 제스처를 만들지 않는다(월 이동은 ‹ › 버튼).
  // 주간회고는 탭이 아니라 설정·배너에서 여는 화면이 됐다 (#1056).
  const [tab, setTab] = useState<'room' | 'calendar'>('room');
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const dateRoutines = useMemo(
    () => routines.filter((r) => isScheduledOn(r, selectedDate)),
    [routines, selectedDate],
  );
  // 참조 고정 (#771) — Calendar가 memo라, 매 렌더 새 함수면 42칸이 매번 다시 그려진다.
  const pickDate = useStableCallback((date: string) => {
    setSelectedDate(date);
    if (date !== today) onSelectDate?.(date);
  });
  const catMeta = allCategories ?? categories;
  const serverBackedDay = !!onSelectDate && selectedDate !== today;
  const dayItems = serverBackedDay ? calendarDays?.[selectedDate] : undefined;
  // 선택한 날짜의 전체 완료/총 개수 (#346) — 방탭의 2/4 + 진행 바와 같은 표시.
  const calDayTotal = serverBackedDay ? (dayItems?.length ?? 0) : dateRoutines.length;
  const calDayDone = serverBackedDay
    ? (dayItems?.filter((i) => i.completed).length ?? 0)
    : dateRoutines.filter((r) => isDone(r.id, selectedDate)).length;

  // 달력 서버 날짜에서 연 메뉴 — 완료 라벨/토글은 그 날의 기록과 달력 규칙
  // (미래 차단, 과거 허용)을 따른다 (#323).
  const menuCalItem =
    menuOpenId && serverBackedDay ? dayItems?.find((i) => i.id === menuOpenId) : undefined;
  const menuDone = menuCalItem
    ? menuCalItem.completed
    : menuRoutine
      ? isDone(menuRoutine.id, menuDate)
      : false;

  // Quick-add is limited to real (non-deleted) categories; 미분류(pseudo)와
  // 미션 연동 카테고리는 임의 추가를 막는다 — 방탭·달력탭 공통 규칙 (#323).
  // 예외 (#626): 완전 빈 계정의 미분류(id '')는 첫 추가의 출발점이라 연다 —
  // categoryId 없이 생성되고, 다음 로드의 고아 입양이 실제 미분류로 수렴한다.
  const canQuickAdd = useCallback(
    (categoryId?: string) =>
      categoryId === ''
        ? categories.length === 0
        : !!categoryId &&
          categories.some((c) => c.id === categoryId) &&
          !quickAddDisabledCategoryIds.includes(categoryId),
    [categories, quickAddDisabledCategoryIds],
  );

  // 달력 lists mirror the room tab's category sections (emoji + colored label
  // + done count). Empty groups still render when they can quick-add — the +
  // must stay reachable on any date, like the room tab (#323).
  const calClientGroups = useMemo(() => {
    const hasUncategorizedCal = dateRoutines.some(
      (r) => !r.category || !knownIds.includes(r.category),
    );
    const calGroupsBase =
      categories.length > 0
        ? [...categories, ...(hasUncategorizedCal ? [UNCATEGORIZED_META] : [])]
        : dateRoutines.length > 0
          ? [UNCATEGORIZED_META]
          : [];
    return calGroupsBase
      .map((cat) => {
        const isUncategorized = cat.id === '';
        const items = dateRoutines.filter(
          (r) =>
            r.category === cat.id ||
            (isUncategorized && (!r.category || !knownIds.includes(r.category))),
        );
        return { meta: cat, items: sinkDone(items, (r) => isDone(r.id, selectedDate)) };
      })
      .filter((g) => g.items.length > 0 || canQuickAdd(g.meta.id));
  }, [categories, dateRoutines, knownIds, sinkDone, isDone, selectedDate, canQuickAdd]);
  // Server days group by the record-time categoryId (kept in server order:
  // categoryId asc, 미분류 last); deleted categories resolve via catMeta.
  const calServerGroups = useMemo(() => {
    if (!dayItems) return undefined;
    const byCat = new Map<string, CalendarDayItem[]>();
    for (const item of dayItems) {
      const key = item.category ?? '';
      byCat.set(key, [...(byCat.get(key) ?? []), item]);
    }
    const groups = Array.from(byCat, ([key, items]) => ({
      meta: catMeta.find((c) => c.id === key) ?? UNCATEGORIZED_META,
      items: sinkDone(items, (i) => i.completed),
    }));
    // 그 날 항목이 없는 현재 카테고리도 헤더를 렌더 — +로 할 일 추가 (#323).
    for (const cat of categories) {
      if (canQuickAdd(cat.id) && !groups.some((g) => g.meta.id === cat.id)) {
        groups.push({ meta: cat, items: [] });
      }
    }
    return groups;
  }, [dayItems, catMeta, categories, canQuickAdd, sinkDone]);

  // 방 뷰 캡처 대상 (#245) — 갤러리 저장은 네이티브 전용.
  const roomShotRef = useRef<View>(null);
  // 캡처 동안 뽑기 버튼을 숨긴다 (#475) — view-shot이 보이는 트리를 찍으므로,
  // 이 플래그로 버튼을 잠깐 감췄다가 저장 후 되돌린다.
  const [capturing, setCapturing] = useState(false);
  const onSaveRoomImage = async () => {
    setCapturing(true);
    // 상태 반영(버튼 숨김)이 네이티브에 커밋된 뒤 찍히도록 두 프레임 양보.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const result = await saveRoomImage(roomShotRef).finally(() => setCapturing(false));
    if (result === 'saved') toast('방 이미지를 갤러리에 저장했어요', 'success');
    else if (result === 'denied') toast('사진 접근 권한을 허용해주세요', 'error');
    else if (result === 'unsupported') toast('웹에서는 이미지 저장을 지원하지 않아요', 'error');
    else toast('이미지 저장에 실패했어요', 'error');
  };

  // <Room />에 스프레드로 넘기는 씬 번들 (#691).
  const roomScene: RoomSceneProps = {
    characterId,
    characterFrames,
    cobweb,
    onCleanCobweb: onCleanCobweb ? handleCleanCobweb : undefined,
    wallpaperId,
    floorId,
    backgroundId,
    placements,
    furniture,
    wallpapers,
    floors,
    backgrounds,
  };

  // 홈 위젯용 무음 방 캡처 (#604) — 로직은 my-room/use-widget-room-capture로
  // 이동 (#693). 시그니처가 바뀐 방만 다시 찍는다.
  // 위젯 캡처 트리거용 서명 — placements(가구 배치 전량)까지 직렬화하므로
  // 렌더마다 돌면 비싸다 (#771). 입력이 바뀔 때만 계산한다.
  const roomSignature = useMemo(
    () =>
      JSON.stringify({
        wallpaperId,
        floorId,
        backgroundId,
        placements,
        characterId,
      }),
    [wallpaperId, floorId, backgroundId, placements, characterId],
  );
  useWidgetRoomCapture({
    shotRef: roomShotRef,
    signature: roomSignature,
    loading,
    capturing,
    setCapturing,
  });

  // Scroll the tapped category's quick-add input into view (above the keyboard).
  const scrollRef = useRef<ScrollView>(null);
  // 서브화면(꾸미기·루틴 관리 …)에 다녀와도 보던 자리로 (#763).
  const scrollRestore = useScrollRestore(scrollRef, { getInitialScrollY, onScrollY });
  const addRowRef = useRef<View>(null);
  const todoInputRef = useRef<TextInput>(null);
  // Set while opening the date picker so the input's blur doesn't commit/close.
  const skipBlurCommit = useRef(false);

  // Track the keyboard height: while the quick-add input is open, that much
  // bottom padding is added to the scroll content. Without it, short content
  // has no scroll range at all (scrollTo clamps at the content end) and the
  // input stays hidden behind the keyboard — Android (edge-to-edge) overlays
  // the keyboard without resizing the window.
  const [keyboardPad, setKeyboardPad] = useState(0);
  // Ref mirrors for the measure callback below (kept out of its deps so the
  // callback identity stays stable for the timers/effects that call it).
  const keyboardPadRef = useRef(0);
  const scrollYRef = useRef(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = e.endCoordinates?.height ?? 320;
      keyboardPadRef.current = h;
      setKeyboardPad(h);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardPadRef.current = 0;
      setKeyboardPad(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Bring the quick-add input itself into view (not just the category header —
  // long categories left it hidden behind the keyboard). Measured in window
  // coordinates and scrolled by the overflow: measureLayout against
  // getInnerViewNode() silently no-ops when that ref API is unavailable (new
  // architecture), which left the input hidden behind the keyboard.
  const scrollToQuickAdd = useCallback(() => {
    const scrollView = scrollRef.current;
    const row = addRowRef.current;
    if (!scrollView || !row) return;
    row.measureInWindow?.((_x, y, _w, h) => {
      // Keep the input row fully visible above the keyboard, with a margin.
      const visibleBottom = Dimensions.get('window').height - keyboardPadRef.current - 24;
      const overflow = y + h - visibleBottom;
      if (overflow > 0) {
        scrollView.scrollTo({ y: Math.max(0, scrollYRef.current + overflow), animated: true });
      }
    });
  }, []);

  // Re-align once the keyboard is up AND the extra bottom padding has been
  // committed — only then is there guaranteed scroll range for the input.
  useEffect(() => {
    if (!addingCategory || keyboardPad === 0) return;
    const timer = setTimeout(scrollToQuickAdd, 50);
    return () => clearTimeout(timer);
  }, [addingCategory, keyboardPad, scrollToQuickAdd]);

  // 방탭은 오늘, 달력탭은 선택한 날짜를 기본 마감일로 연다 (#323).
  const openQuickAdd = (categoryId: string, defaultDate = today) => {
    setNewTodoDate(defaultDate);
    const opening = addingCategory !== categoryId;
    setAddingCategory(opening ? categoryId : null);
    if (opening) {
      // First pass once the input has rendered (fast feedback); the effect
      // above does the authoritative pass after the keyboard + padding settle.
      setTimeout(scrollToQuickAdd, 80);
    }
  };

  const commitTodo = (categoryId: string, raw: string) => {
    // Blur fired only to open the date picker → keep the input open.
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
    const title = raw.trim();
    // 새 행이 뚝 나타나는 대신 부드럽게 삽입되고 기존 행이 밀려난다 (#452).
    if (title) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (title) onQuickAddRoutine?.(categoryId, title, newTodoDate);
    // 행이 닫히며 언마운트되므로 입력 상태는 자연히 사라진다.
    setAddingCategory(null);
  };

  // 카테고리 헤더의 + 버튼 — 방탭·달력탭 공용 (#323).
  const renderQuickAddButton = (meta: RoutineCategoryMeta, defaultDate: string) =>
    canQuickAdd(meta.id) ? (
      <ScalePressable
        onPress={() => openQuickAdd(meta.id, defaultDate)}
        accessibilityRole="button"
        accessibilityLabel={`${meta.name} 할 일 추가`}
        hitSlop={8}
        style={[styles.catAdd, { backgroundColor: meta.color }]}>
        <Icon name="add" size={14} color={t.onPrimary} />
      </ScalePressable>
    ) : null;

  // 퀵애드 입력행 — 제목 입력 + 마감일 칩, blur가 커밋. 방탭·달력탭 공용 (#323).
  const renderQuickAddRow = (categoryId: string) => (
    <QuickAddRow
      ref={addRowRef}
      inputRef={todoInputRef}
      dateLabel={newTodoDate === today ? '오늘' : formatDate(newTodoDate)}
      onCommit={(title) => commitTodo(categoryId, title)}
      onOpenDatePicker={() => setTodoDateOpen(true)}
      // press-in은 입력의 blur보다 먼저 발화한다 — 이 blur는 피커 때문임을
      // 표시해 행이 닫히지 않게 한다.
      onDatePickerPressIn={() => {
        skipBlurCommit.current = true;
      }}
    />
  );

  // Completion is toggled for a specific date (오늘 in 방, 선택한 날짜 in 달력).
  const handleToggle = (routine: Routine, date: string, e?: GestureResponderEvent) => {
    const done = isDone(routine.id, date);
    // 코인 플라이는 서버가 실제 보상을 준 완료에만 (#444) — 탭 좌표는 지금
    // 읽어두고, 발사는 보상액이 확인된 뒤에 한다. 상한 도달(보상 0)은 훅이
    // 상한 토스트를 띄우고 여기선 침묵.
    const flyFrom =
      !done && date === today && e ? { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY } : null;
    const fire = () => {
      const res = onToggleCompletion?.(routine.id, date);
      if (flyFrom && res && typeof res.then === 'function') {
        void res.then((result) => {
          if (result?.rewardAmount) showReward(result.rewardAmount, flyFrom);
        });
      }
    };
    if (done) hapticSelection();
    else hapticSuccess();
    fire();
  };

  // Server-backed (non-today) 달력 rows: future dates are blocked outright;
  // past routines and todos both toggle for real (the server accepts past-date
  // routine logs — reward is 0 coins for non-today completion, #183).
  const handleCalendarItemPress = (item: CalendarDayItem) => {
    if (selectedDate > today) {
      toast('미래 날짜는 완료할 수 없어요', 'error');
      return;
    }
    if (item.completed) hapticSelection();
    else hapticSuccess();
    onToggleCalendarItem?.(item, selectedDate);
  };

  // ---------- 방탭·달력탭 공용 카테고리 그룹 렌더 (#482 후속) ----------
  // 같은 그룹(헤더+행)이 3벌 복붙돼 아이콘 색·배지 유무가 탭마다 어긋났다.
  // 행 데이터를 RowSpec으로 정규화해 Routine(방탭·달력 클라이언트)과 서버
  // CalendarDayItem이 같은 코드로 그려진다.
  type RowSpec = {
    key: string;
    title: string;
    done: boolean;
    /** 알림/마감 시각 — 있으면 종 배지. */
    time?: string;
    /** 반복 루틴 — 제목 뒤 은은한 ↻ 마커로 1회성 투두와 구분 (#576, 시안 A). */
    repeats?: boolean;
    onToggle: (e?: GestureResponderEvent) => void;
    /** 없으면(기록만 남은 삭제 항목) 행 본문이 메뉴를 열지 않는다. */
    onMenu?: () => void;
    /** 스와이프 삭제 (#566) — 없으면(서버 기반 달력 항목 등) 스와이프 비활성. */
    onDelete?: () => void;
  };

  const rowFromRoutine = (routine: Routine, date: string): RowSpec => ({
    repeats: routine.kind !== 'todo',
    key: routine.id,
    title: routine.title,
    done: isDone(routine.id, date),
    time: routine.alarmEnabled && routine.time ? routine.time : undefined,
    onToggle: (e) => handleToggle(routine, date, e),
    onMenu: () => openRowMenu(routine.id, date),
    // 메뉴 시트의 삭제하기와 같은 경로 — 스와이프는 지름길일 뿐이다 (#566).
    onDelete: onDeleteRoutine ? () => onDeleteRoutine(routine.id) : undefined,
  });

  const rowFromCalendarItem = (item: CalendarDayItem): RowSpec => ({
    repeats: item.kind === 'routine',
    key: `${item.kind}-${item.id}`,
    title: item.title,
    done: item.completed,
    time: item.time,
    onToggle: () => handleCalendarItemPress(item),
    // 기록만 남은(삭제된) 항목은 메뉴를 열 수 없다 — 그대로 표시만.
    onMenu: routines.some((r) => r.id === item.id)
      ? () => openRowMenu(item.id, selectedDate)
      : undefined,
  });

  // --- 루틴/투두 롱프레스 재정렬 (#716) ---
  // 방 '오늘' 리스트의 미완료 행만 대상. 롱프레스로 들어 손가락을 따라가고,
  // 놓으면 같은 카테고리면 순서 변경(로컬), 다른 카테고리 그룹 위면 영구
  // 이동(서버). 완료 행은 하단으로 가라앉은 상태라 드래그에서 제외한다.
  const reorderEnabled = !!onReorderRoutines && tab === 'room';
  const [dragId, setDragId] = useState<string | null>(null);
  const dragTY = useAnimatedValue(0);
  const rowRefs = useRef(new Map<string, View>());
  const dragSlotsRef = useRef<DragSlot[]>([]);
  const dropRef = useRef<DropTarget | null>(null);
  // 드래그 시작 시점의 카테고리별 미완료 id 순서 스냅샷 — 드롭 계산의 기준.
  const baseOrderRef = useRef<Map<string, string[]>>(new Map());

  const beginDrag = useCallback(
    (routineId: string) => {
      hapticSelection();
      setDragId(routineId);
      const base = new Map<string, string[]>();
      for (const g of roomGroups) {
        base.set(
          g.meta.id,
          g.items.filter((r) => !isDone(r.id, today)).map((r) => r.id),
        );
      }
      baseOrderRef.current = base;
      const catOf = (id: string) =>
        [...base.entries()].find(([, ids]) => ids.includes(id))?.[0] ?? '';
      // window 좌표 측정은 비동기 — 다음 프레임 안에 채워져 onUpdate가 쓴다
      // (집 좌석 드래그 #278와 같은 리프트 시점 측정).
      dragSlotsRef.current = [];
      rowRefs.current.forEach((node, id) => {
        node.measureInWindow((x, y, w, h) => {
          dragSlotsRef.current.push({
            routineId: id,
            categoryId: catOf(id),
            top: y,
            bottom: y + h,
          });
        });
      });
    },
    [roomGroups, isDone, today],
  );

  const updateDrop = useCallback((draggedId: string, absoluteY: number) => {
    dropRef.current = resolveDrop(dragSlotsRef.current, absoluteY, draggedId);
  }, []);

  const endDrag = useCallback(
    (draggedId: string, fromCategoryId: string) => {
      const target = dropRef.current;
      dropRef.current = null;
      setDragId(null);
      dragTY.setValue(0);
      if (!target) return;
      // 실제 카테고리가 있을 때 '미분류'로의 이동은 서버 반영이 안 돼(#718
      // 리뷰) 스냅백 — 미분류 내 순서 변경은 아래 same-category 분기로 허용.
      if (isRejectedDrop(target, fromCategoryId, categories.length > 0)) return;
      const destBase = baseOrderRef.current.get(target.categoryId) ?? [];
      if (target.categoryId === fromCategoryId) {
        const next = reorderedIds(destBase, draggedId, target.index);
        // 구분자는 반드시 이스케이프 `\0`로 — 예전엔 리터럴 NUL 문자를 그대로
        // 박아 넣어서, grep·ripgrep이 이 파일을 바이너리로 보고 **1600줄 전체가
        // 검색에서 사라졌다**. 동작은 같지만 도구에 보이는지가 다르다.
        if (next.join('\0') !== destBase.join('\0')) {
          hapticSuccess();
          onReorderRoutines?.(fromCategoryId, next);
        }
        return;
      }
      // 다른 카테고리 = 영구 이동(서버) + 양쪽 로컬 순서 갱신.
      hapticSuccess();
      onMoveRoutineCategory?.(draggedId, target.categoryId);
      onReorderRoutines?.(target.categoryId, reorderedIds(destBase, draggedId, target.index));
      const fromNext = (baseOrderRef.current.get(fromCategoryId) ?? []).filter(
        (id) => id !== draggedId,
      );
      onReorderRoutines?.(fromCategoryId, fromNext);
    },
    [dragTY, onReorderRoutines, onMoveRoutineCategory, categories.length],
  );

  const registerRowRef = useCallback((routineId: string, node: View | null) => {
    if (node) rowRefs.current.set(routineId, node);
    else rowRefs.current.delete(routineId);
  }, []);

  /**
   * 행 핸들러 레지스트리 (#769) — RowSpec의 콜백은 매 렌더 새 클로저라 그대로
   * 넘기면 memo가 무효다. 렌더마다 이 맵만 갈아끼우고, 행에는 아래 참조 고정
   * 디스패처를 넘긴다. 행이 memo로 리렌더를 건너뛰어도 맵은 최신이라 낡은
   * 클로저를 잡지 않는다.
   */
  const rowHandlers = useConstant(() => new Map<string, { spec: RowSpec; categoryId?: string }>());
  const dragIdRef = useLatestRef(dragId);
  const dispatchToggle = useStableCallback((rowKey: string, e?: GestureResponderEvent) =>
    rowHandlers.get(rowKey)?.spec.onToggle(e),
  );
  const dispatchMenu = useStableCallback((rowKey: string) =>
    rowHandlers.get(rowKey)?.spec.onMenu?.(),
  );
  const dispatchDelete = useStableCallback((rowKey: string) =>
    rowHandlers.get(rowKey)?.spec.onDelete?.(),
  );
  const dispatchDragStart = useStableCallback((rowKey: string) => beginDrag(rowKey));
  const dispatchDragUpdate = useStableCallback((rowKey: string, absoluteY: number) =>
    updateDrop(rowKey, absoluteY),
  );
  const dispatchDragEnd = useStableCallback((rowKey: string) => {
    const categoryId = rowHandlers.get(rowKey)?.categoryId;
    if (categoryId !== undefined) endDrag(rowKey, categoryId);
  });
  const dispatchDragFinalize = useStableCallback((rowKey: string) => {
    if (dragIdRef.current !== rowKey) return;
    setDragId(null);
    dragTY.setValue(0);
  });

  // 카테고리 그룹 = 헤더(아이콘·라벨·공개범위·카운트·＋) + 행들 + 퀵애드 입력행.
  // 빈 그룹도 헤더는 그린다 — ＋가 항상 닿아야 한다 (#323).
  const renderCategoryGroup = (
    key: string,
    meta: RoutineCategoryMeta,
    rows: RowSpec[],
    date: string,
  ) => {
    const doneCount = rows.filter((r) => r.done).length;
    // 이번 렌더의 콜백으로 레지스트리를 갱신한다 (#769) — 행이 memo로
    // 리렌더를 건너뛰어도 디스패처는 항상 최신 클로저를 부른다.
    for (const row of rows) rowHandlers.set(row.key, { spec: row, categoryId: meta.id });
    return (
      <View key={key} style={styles.group}>
        <View style={styles.catHeader}>
          {/* 미분류(pseudo) 그룹은 실제 카테고리가 아니라 수정 진입이 없다 (#541). */}
          <Pressable
            style={styles.catHeaderTap}
            disabled={!meta.id || !onUpdateCategory}
            onPress={() => setEditingCategory(meta)}
            accessibilityRole="button"
            accessibilityLabel={`${meta.name} 카테고리 수정`}>
            <View style={[styles.catDot, { backgroundColor: `${meta.color}33` }]}>
              <CategoryIcon name={meta.icon} color={meta.color} size={18} />
            </View>
            <Text
              style={[
                Typography.label,
                styles.catLabel,
                { color: readableTextColor(meta.color, t.surfaceMuted) },
              ]}>
              {meta.name}
            </Text>
          </Pressable>
          {/* 미분류(pseudo) 그룹은 실제 카테고리가 아니라 표시하지 않는다. */}
          {meta.id ? <VisibilityMark visibility={meta.visibility} /> : null}
          {rows.length > 0 ? (
            <Text style={[Typography.supporting, { color: t.textDisabled }]}>
              {doneCount}/{rows.length}
            </Text>
          ) : null}
          <View style={styles.flex} />
          {renderQuickAddButton(meta, date)}
        </View>
        <View style={styles.rows}>
          {/* categoryId를 넘겨 방 탭에서만 드래그 활성 — 달력 탭은
              reorderEnabled(tab==='room')가 false라 categoryId를 받아도 무효. */}
          {rows.map((row) => {
            const draggable = reorderEnabled && !row.done && meta.id !== undefined;
            return (
              <RoutineRow
                key={row.key}
                rowKey={row.key}
                title={row.title}
                done={row.done}
                time={row.time}
                repeats={row.repeats}
                color={meta.color}
                draggable={draggable}
                active={dragId === row.key}
                dragTY={dragTY}
                menuEnabled={!!row.onMenu}
                deleteEnabled={!!row.onDelete}
                onToggle={dispatchToggle}
                onMenu={dispatchMenu}
                onDelete={dispatchDelete}
                onDragStart={dispatchDragStart}
                onDragUpdate={dispatchDragUpdate}
                onDragEnd={dispatchDragEnd}
                onDragFinalize={dispatchDragFinalize}
                registerRef={registerRowRef}
              />
            );
          })}
          {addingCategory === meta.id ? renderQuickAddRow(meta.id) : null}
        </View>
      </View>
    );
  };

  return (
    <View ref={rootRef} style={[styles.screen, useScreenStyle([])]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <PawRefreshScroll
          scrollRef={scrollRef}
          onRefresh={onRefresh}
          refreshTestID="my-room-refresh"
          // 재정렬 드래그 중엔 세로 스크롤을 잠근다 (#716).
          scrollEnabled={dragId === null}
          contentContainerStyle={[
            styles.body,
            // 달력 탭은 방이 없어 떠 있는 크롬(#1055) 밑으로 콘텐츠를 내린다.
            tab !== 'room' ? { paddingTop: insets.top + Spacing.two + CHROME_ROW_HEIGHT } : null,
            navInset ? { paddingBottom: Spacing.six + navInset } : null,
            addingCategory != null && keyboardPad > 0 ? { paddingBottom: keyboardPad + 120 } : null,
          ]}
          {...scrollRestore}
          onScroll={(e) => {
            // 빠른 추가 입력 스크롤인(#…)용 로컬 추적 + 셸의 탭별 기억(#763).
            scrollYRef.current = e.nativeEvent.contentOffset.y;
            scrollRestore.onScroll?.(e);
          }}
          keyboardShouldPersistTaps="handled">
          {tab === 'room' ? (
            <>
              <View style={styles.roomWrap}>
                {/*
                    캡처 대상은 방 자체만 (#778) — 예전엔 ref가 패딩 있는
                    roomWrap에 붙어 있어 그 **투명 여백까지 찍혔고**, #744에서
                    캡처를 JPEG(알파 없음)로 바꾸면서 여백이 검정으로 눌러붙어
                    위젯에 검은 띠가 생겼다. 플로팅 버튼들은 roomWrap 기준
                    absolute라 바깥에 남겨도 위치가 그대로다.
                    전체화면(#1055): 방이 화면 폭을 다 쓰고 상태바 밑까지 올라간다 —
                    집 탭의 하늘처럼. 위 모서리는 각지게, 아래는 종전 둥근 모서리.
                  */}
                <View ref={roomShotRef} collapsable={false}>
                  <Room {...roomScene} interactiveCharacter style={styles.roomFullBleed} />
                </View>
                {/* 오른쪽 버튼 열 (#1055) — 메뉴·알림(헤더에서 이동)·꾸미기·뽑기.
                    방 이미지 저장 중에는 통째로 빼서 사진에서 제외한다 (#475).
                    opacity로 숨기면 글래스 면(#1050)이 안 그려지고 복귀가 불안정. */}
                {capturing ? null : (
                  <View style={styles.btnColumn}>
                    <CoachTarget id="room-menu">
                      <Pressable
                        ref={menuBtnRef}
                        onPress={openNavMenu}
                        accessibilityRole="button"
                        accessibilityLabel={
                          attendance?.pending && onOpenAttendance ? '메뉴, 오늘 미출석' : '메뉴'
                        }
                        style={styles.floatBtn}>
                        <GlassSurface style={styles.floatFace} fallbackColor={t.surface}>
                          <Icon name="menu" size={20} color={t.text} />
                          {/* 출석 이벤트가 메뉴 안으로 들어가(#1055) 미출석 점은 여기에. */}
                          {attendance?.pending && onOpenAttendance ? (
                            <View style={[styles.menuDot, { backgroundColor: t.danger }]} />
                          ) : null}
                        </GlassSurface>
                      </Pressable>
                    </CoachTarget>
                    {onOpenNotifications ? (
                      <Pressable
                        onPress={onOpenNotifications}
                        accessibilityRole="button"
                        accessibilityLabel="알림"
                        style={styles.floatBtn}>
                        <GlassSurface style={styles.floatFace} fallbackColor={t.surface}>
                          <Icon name="bell" size={20} color={t.text} />
                          {unreadNotificationCount > 0 ? (
                            <View style={[styles.menuDot, { backgroundColor: t.danger }]} />
                          ) : null}
                        </GlassSurface>
                      </Pressable>
                    ) : null}
                    {/* 방 꾸미기 1탭 승격 (#727) — 보상 루프의 종착지를 뽑기 옆에. */}
                    {onEdit ? (
                      <Pressable
                        onPress={onEdit}
                        accessibilityRole="button"
                        accessibilityLabel="방 꾸미기"
                        style={styles.floatBtn}>
                        <GlassSurface style={styles.floatFace} fallbackColor={t.surface}>
                          <Icon name="edit" size={20} color={t.text} />
                        </GlassSurface>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={onOpenGacha}
                      accessibilityRole="button"
                      accessibilityLabel="뽑기 상점"
                      style={styles.floatBtn}>
                      <GlassSurface style={styles.floatFace} fallbackColor={t.surface}>
                        {/* absolute 버튼이라 래퍼 대신 내용을 측정 (#351). */}
                        <CoachTarget id="room-gacha">
                          <Icon name="gift" size={20} color={t.text} />
                        </CoachTarget>
                      </GlassSurface>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* 폭 제한(#725)은 목록에만 — 방은 전체 폭 (#1055). */}
              <View style={[styles.section, column]}>
                <CoachTarget id="room-routines">
                  <View style={styles.sectionHead}>
                    <Text style={[Typography.h2, { color: t.text }]}>오늘의 할 일</Text>
                    <View style={styles.sectionHeadRight}>
                      {roomRoutines.length > 0 ? (
                        <Text style={[Typography.label, { color: t.primaryText }]}>
                          {completedCount} / {roomRoutines.length}
                        </Text>
                      ) : null}
                      <CoachTarget id="room-add-routine">
                        {/* '＋ 루틴' 라벨 필 (#483) — 카테고리의 원형 ＋(할 일 추가)와
                            같은 문법이라 헷갈렸다. 라벨로 용도를 말해 구분한다. */}
                        <Pressable
                          onPress={onAddRoutine}
                          accessibilityRole="button"
                          accessibilityLabel="루틴 추가"
                          style={[styles.addPill, { backgroundColor: t.primary }]}>
                          <Icon name="add" size={14} color={t.onPrimary} />
                          <Text style={[Typography.label, { color: t.onPrimary }]}>루틴</Text>
                        </Pressable>
                      </CoachTarget>
                    </View>
                  </View>
                </CoachTarget>

                {loading ? (
                  <View style={styles.stateBlock}>
                    <Loading />
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>
                      불러오는 중...
                    </Text>
                  </View>
                ) : null}

                {!loading && loadError ? (
                  <View style={styles.stateBlock}>
                    <RetryState message="데이터를 불러오지 못했어요." onRetry={onRetry} />
                  </View>
                ) : null}

                {!loading && !loadError && roomRoutines.length > 0 ? (
                  <SpringProgressBar
                    progress={progress}
                    color={t.primary}
                    trackColor={t.surfaceMuted}
                  />
                ) : null}

                {loading || loadError
                  ? null
                  : roomGroups.map(({ meta: cat, items }) =>
                      // Empty categories still render their header — the + quick-add
                      // must stay reachable even before the first routine exists.
                      renderCategoryGroup(
                        cat.id,
                        cat,
                        items.map((r) => rowFromRoutine(r, today)),
                        today,
                      ),
                    )}
              </View>
            </>
          ) : (
            <View style={[styles.calendarPanel, column]}>
              {/* monthSwipe=false 유지 (#825) — 달력 위 가로 스와이프가 월
                  이동이라는 또 다른 뜻을 갖게 되면 "가로 스와이프 = 하단 탭
                  이동" 규칙이 다시 깨진다. 월 이동은 ‹ › 버튼. */}
              <Calendar
                value={selectedDate}
                onSelect={pickDate}
                today={today}
                monthSwipe={false}
                markedDates={markedTodoDates}
                onVisibleMonthChange={onCalendarMonthChange}
              />
              <View style={styles.calListHead}>
                <Text style={[Typography.h3, styles.calListTitle, { color: t.text }]}>
                  이 날의 할 일
                </Text>
                {calDayTotal > 0 ? (
                  <Text style={[Typography.label, { color: t.primaryText }]}>
                    {calDayDone} / {calDayTotal}
                  </Text>
                ) : null}
              </View>
              {calDayTotal > 0 ? (
                <SpringProgressBar
                  progress={calDayDone / calDayTotal}
                  color={t.primary}
                  trackColor={t.surfaceMuted}
                />
              ) : null}
              {serverBackedDay ? (
                <Text style={[Typography.supporting, { color: t.textMuted }]}>
                  {selectedDate > today
                    ? '미래 날짜는 아직 완료할 수 없어요.'
                    : '지난 날짜도 완료 체크할 수 있어요. (코인은 당일 완료에만 지급돼요)'}
                </Text>
              ) : null}
              {loading || (serverBackedDay && !dayItems) ? (
                <View style={styles.stateBlock}>
                  <Loading />
                </View>
              ) : serverBackedDay ? (
                calServerGroups!.length === 0 ? (
                  <Text style={[Typography.body, styles.calEmpty, { color: t.textMuted }]}>
                    예정된 루틴이 없어요.
                  </Text>
                ) : (
                  calServerGroups!.map((group, gi) =>
                    renderCategoryGroup(
                      group.meta.id || `uncat-${gi}`,
                      group.meta,
                      group.items.map(rowFromCalendarItem),
                      selectedDate,
                    ),
                  )
                )
              ) : calClientGroups.length === 0 ? (
                <Text style={[Typography.body, styles.calEmpty, { color: t.textMuted }]}>
                  예정된 루틴이 없어요.
                </Text>
              ) : (
                calClientGroups.map((group, gi) =>
                  renderCategoryGroup(
                    group.meta.id || `uncat-${gi}`,
                    group.meta,
                    group.items.map((r) => rowFromRoutine(r, selectedDate)),
                    selectedDate,
                  ),
                )
              )}
            </View>
          )}
        </PawRefreshScroll>
      </KeyboardAvoidingView>

      {/* 떠 있는 크롬 (#1055) — 헤더바 대신 이름 알약과 방/달력 세그먼트가 방 위에
          뜬다. 스크롤 바깥 오버레이라 목록을 내려도 제자리. */}
      <View pointerEvents="box-none" style={[styles.chromeRow, { top: insets.top + Spacing.two }]}>
        <GlassSurface interactive={false} fallbackColor={t.surface} style={styles.namePill}>
          {/* Narrow phones: shrink the font (≥75%) first; if the title still
              overflows, middle-ellipsize so the 의 방 suffix stays visible. */}
          <Text
            style={[Typography.label, { color: t.text }]}
            numberOfLines={1}
            ellipsizeMode="middle"
            adjustsFontSizeToFit
            minimumFontScale={0.75}>
            {userName ? `${userName}의 방` : '내 방'}
          </Text>
        </GlassSurface>
        <GlassSurface interactive={false} fallbackColor={t.surface} style={styles.segment}>
          {(
            [
              ['room', '방'],
              ['calendar', '달력'],
            ] as const
          ).map(([key, label]) => {
            const active = tab === key;
            const btn = (
              <Pressable
                onPress={() => setTab(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={label}
                style={[styles.segmentItem, active && { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: active ? t.primaryText : t.textMuted }]}>
                  {label}
                </Text>
              </Pressable>
            );
            // 달력 탭은 코치마크 대상 (#351).
            return key === 'calendar' ? (
              <CoachTarget key={key} id="room-tab-calendar">
                {btn}
              </CoachTarget>
            ) : (
              <View key={key}>{btn}</View>
            );
          })}
        </GlassSurface>
      </View>

      {/* 보상 알약 (#1055) — 완료 보상이 확인된 순간에만 크롬 아래 가운데에 떠서
          스트릭·코인 증분을 보여주고 사라진다. 코인 플라이의 목적지. */}
      {reward ? (
        <View
          pointerEvents="none"
          style={[
            styles.rewardWrap,
            { top: insets.top + Spacing.two + CHROME_ROW_HEIGHT + Spacing.three },
          ]}>
          <Animated.View
            ref={rewardPillRef}
            onLayout={measureRewardPill}
            style={{ transform: [{ scale: rewardPulse }] }}>
            <GlassSurface interactive={false} fallbackColor={t.surface} style={styles.rewardPill}>
              {/* A 0-day streak is nothing to celebrate — show the flame only
                  once a streak exists. */}
              {streakDays > 0 ? (
                <Animated.View style={[styles.streak, { transform: [{ scale: streakPulse }] }]}>
                  <Icon name="flame" size={14} color={t.warningText} />
                  <Text style={[Typography.label, { color: t.warningText }]}>{streakDays}일</Text>
                </Animated.View>
              ) : null}
              <View style={styles.streak}>
                <Icon name="coin" size={14} color={t.warning} />
                <Text style={[Typography.label, { color: t.text }]}>+{reward.coins}</Text>
              </View>
            </GlassSurface>
          </Animated.View>
        </View>
      ) : null}

      <CategoryFormSheet
        visible={editingCategory !== null}
        editing={editingCategory}
        onUpdate={onUpdateCategory}
        onClose={() => setEditingCategory(null)}
      />

      <RoutineMenuSheet
        item={menuRoutine}
        done={menuDone}
        onClose={() => setMenuOpenId(null)}
        onRename={(r) => setRenameId(r.id)}
        onEdit={(r) => onEditRoutine?.(r)}
        onDelete={(r) => onDeleteRoutine?.(r.id)}
        onToggleComplete={(r) => {
          // 서버 백업 날짜에서 연 메뉴는 달력 체크박스와 같은 규칙으로
          // 토글한다 (미래 차단 토스트, 과거 실토글) (#323).
          if (menuCalItem) handleCalendarItemPress(menuCalItem);
          else handleToggle(r, menuDate);
        }}
        onEditTime={(r) => setTimeId(r.id)}
        onChangeDate={(r) => setDateEditId(r.id)}
      />

      {/* 날짜 바꾸기: calendar bottom sheet — the pick stays a draft until 확인. */}
      <DateEditSheet
        item={dateEditItem}
        onClose={() => setDateEditId(null)}
        onUpdateTodoDueDate={onUpdateTodoDueDate}
        onMoveRoutineOccurrence={onMoveRoutineOccurrence}
      />

      <RenameDialog
        item={renameItem}
        onClose={() => setRenameId(null)}
        onRename={onRenameRoutine}
      />

      <TodoDateDialog
        visible={todoDateOpen}
        value={newTodoDate}
        onSelect={(date) => {
          setNewTodoDate(date);
          setTodoDateOpen(false);
          // Re-focus the title input so blur-to-commit still works.
          setTimeout(() => todoInputRef.current?.focus(), 60);
        }}
        onClose={() => setTodoDateOpen(false)}
      />

      {/* Header hamburger popover: quick links to the management screens. */}
      <NavMenuPopover
        visible={navMenuOpen}
        top={navMenuTop}
        bottom={navMenuBottom}
        onClose={() => setNavMenuOpen(false)}
        // 출석 이벤트·재화 내역은 헤더 아이콘·지갑 필에서 메뉴 항목으로 (#1055).
        onOpenAttendance={attendance && onOpenAttendance ? onOpenAttendance : undefined}
        attendancePending={!!attendance?.pending}
        onOpenWalletHistory={openWalletHistory}
        onOpenCharacterPicker={
          ownedCharacters && onSelectCharacter ? () => setCharacterSheetOpen(true) : undefined
        }
        onEditRoom={onEdit}
        onSaveRoomImage={() => void onSaveRoomImage()}
        onOpenCategoryManager={() => onManageCategories?.()}
        // + 버튼(onAddRoutine)은 바로 추가로 가고, 관리는 여기서만 (#335).
        onManageRoutines={onManageRoutines ?? onAddRoutine}
      />

      <CharacterPickerSheet
        visible={characterSheetOpen}
        characters={ownedCharacters ?? []}
        onSelect={(serverId) => onSelectCharacter?.(serverId)}
        onClose={() => setCharacterSheetOpen(false)}
      />

      <WalletHistorySheet
        visible={walletHistoryOpen}
        onClose={() => setWalletHistoryOpen(false)}
        entries={walletHistory ?? []}
        loading={walletHistoryLoading}
        loadError={walletHistoryError}
        onRetry={onLoadWalletHistory}
        hasNext={walletHistoryHasNext}
        onLoadMore={onLoadMoreWalletHistory}
      />

      <TimePickerSheet
        visible={timeRoutine !== null}
        initialEnabled={timeRoutine?.alarmEnabled ?? false}
        initialTime={timeRoutine?.time ?? '07:00'}
        onSave={(enabled, time) => {
          if (timeId) onUpdateRoutineTime?.(timeId, enabled, time);
        }}
        onClose={() => setTimeId(null)}
      />

      {/* 완료 보상 코인 플라이 오버레이 (#440) — 탭 지점 → 지갑 필. */}
      {flyingCoins.map((c) => (
        <FlyingCoin key={c.id} {...c} onDone={() => onCoinArrive(c.id)} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  calendarPanel: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  calListTitle: {
    marginTop: Spacing.three,
  },
  // 이 날의 할 일 제목 + 완료/총 카운트 행 (#346) — 방탭 sectionHead와 같은 결.
  calListHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  calEmpty: {
    paddingVertical: Spacing.three,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  menuDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  body: {
    paddingBottom: Spacing.six,
  },
  roomWrap: {
    position: 'relative',
  },
  // 전체화면 방 (#1055) — 위 모서리는 화면 가장자리에 붙으니 각지게.
  roomFullBleed: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  // 오른쪽 버튼 열 (#1055) — 메뉴·알림·꾸미기·뽑기, 아래에서 위로.
  btnColumn: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.three,
    gap: Spacing.two,
  },
  floatBtn: {
    width: 44,
    height: 44,
  },
  // 떠 있는 크롬 줄 (#1055) — 이름 알약(왼쪽)과 세그먼트(오른쪽).
  chromeRow: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    zIndex: 20,
  },
  namePill: {
    flexShrink: 1,
    height: CHROME_ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  segment: {
    flexDirection: 'row',
    height: CHROME_ROW_HEIGHT,
    padding: Spacing.one,
    borderRadius: Radius.pill,
  },
  segmentItem: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  rewardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  // 떠 있는 원형 버튼의 면 (#1050) — 위치·크기는 버튼이, 모양·배경은 면이.
  floatFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeadRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  // '＋ 루틴' 라벨 필 (#483) — 높이는 기존 32px 원과 동일하게 유지.
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    height: 32,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  group: {
    gap: Spacing.half,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  catHeaderTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  // 카테고리 라벨 확대 (#356) — label 토큰(16) 위에 크기만 한 단계 올린다.
  catLabel: {
    fontSize: 18,
    lineHeight: 24,
  },
  catDot: {
    width: 32,
    height: 32,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catAdd: {
    width: 24,
    height: 24,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: {
    gap: 0,
  },
  // 제목 + 반복 마커 한 줄 (#576) — 마커는 제목 바로 옆, 제목이 길면 잘린다.
  // Same width as catDot so checkboxes center under the category emoji and
  // row titles line up with the category label.
  center: {
    textAlign: 'center',
  },
  stateBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
});
