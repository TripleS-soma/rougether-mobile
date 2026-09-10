import { memo, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  Animated,
  type GestureResponderEvent,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { NavMenuPopover } from '@/components/app/nav-menu-popover';
import { FlyingCoin } from '@/components/ui/flying-coin';
import {
  canQuickAddCategory,
  groupCalendarClientRoutines,
  groupCalendarServerItems,
  groupRoomRoutines,
} from '@/components/screens/my-room/grouping';
import { isScheduledOn } from '@/components/screens/my-room/schedule';
import {
  type DragSlot,
  type DropTarget,
  type GroupSlot,
  isRejectedDrop,
  mergeOrderedSubset,
  reorderedIds,
  resolveDrop,
  resolveGroupDrop,
} from '@/components/screens/my-room/routine-drag';
import {
  useAnimatedValue,
  useConstant,
  useLatestRef,
  useStableCallback,
} from '@/hooks/use-stable-value';
import { CategoryDragHandle } from '@/components/screens/my-room/category-drag-handle';
import { RoutineRow } from '@/components/screens/my-room/routine-row';
import { useRewardFly } from '@/components/screens/my-room/use-reward-fly';
import { useRoomImageSave } from '@/components/screens/my-room/use-room-image-save';
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
import {
  RoutineTodoComposeSheet,
  type ComposeKind,
} from '@/components/screens/sheets/routine-todo-compose-sheet';
import { Loading } from '@/components/ui/loading';
import type { CalendarDayCount } from '@/api/types';
import { RoomGrowthPill, type RoomGrowthProps } from '@/components/ui/room-growth-pill';
import { type CalendarFilter } from '@/utils/calendar-progress';
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
  type NewRoutine,
  ROUTINE_CATEGORIES,
  type Routine,
  type RoutineCategoryMeta,
  VISIBILITY_ICONS,
  VISIBILITY_LABELS,
} from '@/constants/routines';
import { Icon } from '@/components/ui/icon';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { ContentMaxWidth, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';
import { useBottomNavInset, useScreenStyle } from '@/hooks/use-screen-style';
import { APP_FRAME_MAX_WIDTH, useAppFrame } from '@/hooks/use-app-frame';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { type ScrollRestoreProps, useScrollRestore } from '@/hooks/use-scroll-restore';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { readableTextColor } from '@/utils/color';
import { localDate, monthDayLabel, todayIso } from '@/utils/datetime';
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

// 떠 있는 크롬 (#1055) — 달력 제목·세그먼트 한 줄의 높이. 달력 탭의 콘텐츠 상단
// 패딩과 보상 알약 위치가 같은 값을 본다.
const CHROME_ROW_HEIGHT = 40;
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
    today?: string;
    growthLevel?: RoomGrowthProps['growthLevel'];
    growthPoints?: number;
    pointsToNextLevel?: number;
    calendarMonthDays?: CalendarDayCount[];
    calendarMonthLoading?: boolean;
    calendarMonthError?: boolean;
    calendarDayError?: boolean;
    onRetryCalendarMonth?: () => void;
    onRetryCalendarDay?: () => void;
    /** 달력에서 보이는 달이 바뀔 때 (#838) — 부모가 그 달 개수를 받아온다. */
    onCalendarMonthChange?: (yearMonth: string) => void;
    /**
     * 보여줄 뷰 (#1138) — 셸이 방 탭엔 'room', 달력 탭엔 'calendar'로 고정한다.
     * 미지정이면(Dev 갤러리·단독 테스트) 방/달력 알약이 남아 스스로 전환한다.
     */
    view?: 'room' | 'calendar';
    /** Controlled selection survives the tab pager unmounting for a sub-screen. */
    selectedDate?: string;
    onSelectedDateChange?: (date: string) => void;
    /** Quick composer → routine form, preserving the selected calendar date. */
    onAddRoutineForDate?: (date: string) => void;
    /** Retained for existing callers; the personal room name is no longer displayed. */
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
    /** Today quick composer → routine form. */
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
    onOpenFurnitureStudio?: () => void;
    /** 당겨서 새로고침 (#454) — 서버 데이터 전체 리로드. resolve까지 발바닥이 두근거린다. */
    onRefresh?: () => Promise<void> | void;
    /** Quick-add a todo to a category with a due date (the + on a category header). */
    onCreateRoutine?: (routine: NewRoutine) => boolean | void | Promise<boolean | void>;
    onQuickAddRoutine?: (
      category: string,
      title: string,
      dueDate: string,
      time?: string,
    ) => boolean | void | Promise<boolean | void>;
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
    /**
     * 롱프레스 재정렬 확정 — 해당 카테고리의 새 루틴 id 순서(미완료 기준). 방 탭과
     * 달력 탭(오늘·서버 날짜) 모두에서 발화한다 (2026-09-08) — 달력 서버 날짜의
     * 행도 루틴 id로 나간다.
     */
    onReorderRoutines?: (categoryId: string, orderedRoutineIds: string[]) => void;
    /** 다른 카테고리로 드롭 = 영구 이동 (#716) — 서버 categoryId 변경. */
    onMoveRoutineCategory?: (id: string, toCategoryId: string) => void;
    /**
     * 카테고리 헤더 롱프레스 드래그 확정 (2026-09-08) — 전체 카테고리 id의 새 순서
     * (미분류 '' 제외, 서버 sortOrder = index). 없으면 헤더 드래그 비활성.
     */
    onReorderCategories?: (orderedCategoryIds: string[]) => void;
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
  today: serverToday,
  growthLevel,
  growthPoints,
  pointsToNextLevel,
  calendarMonthLoading,
  calendarMonthError,
  calendarDayError,
  onRetryCalendarMonth,
  onRetryCalendarDay,
  onCalendarMonthChange,
  view,
  placements = [],
  furniture,
  wallpapers,
  floors,
  backgrounds,
  routines = [],
  allCategories,
  calendarDays,
  selectedDate: controlledSelectedDate,
  onSelectedDateChange,
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
  onOpenFurnitureStudio,
  onRefresh,
  onQuickAddRoutine,
  onCreateRoutine,
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
  onReorderCategories,
  getInitialScrollY,
  onScrollY,
}: MyRoomScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  // 웹 데스크톱 2단 (#1230) — 창 ≥ 960px에서만 true.
  const { split } = useAppFrame();
  const Typography = useTypography();
  // 글래스 알약 바텀바가 떠 있으면 마지막 루틴이 그 밑에 안 숨게 (#1049).
  const navInset = useBottomNavInset();
  // 떠 있는 크롬(#1055)이 상태바 밑에 서지 않게 — 방은 상태바 밑까지 차지한다.
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  // 보상 알약·코인 플라이·스트릭 펄스 (#440 → #1055) — my-room/use-reward-fly.
  const {
    rootRef,
    rewardPillRef,
    rewardPulse,
    streakPulse,
    flyingCoins,
    reward,
    showReward,
    measureRewardPill,
    onCoinArrive,
  } = useRewardFly(streakDays);
  // 거미줄 청소 (#830) — 보상이 실제로 지급됐을 때만 코인이 난다.
  const handleCleanCobweb = async (at: { x: number; y: number }) => {
    const earned = await onCleanCobweb?.();
    if (earned && earned > 0) showReward(earned, at);
  };
  const { show: toast } = useToast();

  const today = serverToday ?? todayIso();
  const isDone = useCallback(
    (id: string, date: string) => (completions[id] ?? []).includes(date),
    [completions],
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

  // 카테고리 그룹 규칙(미분류 꼬리 #517·빈 계정 #626·수동 순서 #716·완료 하단)은
  // my-room/grouping의 순수 함수 — 여기서는 useMemo로 참조만 고정한다.
  const roomGroups = useMemo(
    () =>
      groupRoomRoutines({
        routines: roomRoutines,
        categories,
        routineOrder,
        isDone: (id) => isDone(id, today),
      }),
    [categories, roomRoutines, isDone, today, routineOrder],
  );

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
  const [navMenuRight, setNavMenuRight] = useState<number | undefined>(undefined);
  const menuBtnRef = useRef<View>(null);
  const [characterSheetOpen, setCharacterSheetOpen] = useState(false);
  const openNavMenu = () => {
    setNavMenuOpen(true);
    // measureInWindow is a no-op in tests/web — the fallback top then applies.
    menuBtnRef.current?.measureInWindow?.((x, y, w, h) => {
      if (typeof y === 'number' && typeof h === 'number') {
        setNavMenuTop(y + h + Spacing.one);
        setNavMenuBottom(y > windowHeight / 2 ? windowHeight - y + Spacing.one : undefined);
      }
      // 2단(#1230)에선 버튼이 왼쪽 칸에 있어 프레임 오른쪽 기준 앵커가 700px 빗나간다 —
      // 버튼의 실측 오른쪽 끝에 붙인다. 폰·단일 컬럼은 종전 앵커.
      setNavMenuRight(
        split && typeof x === 'number' && typeof w === 'number' ? windowWidth - (x + w) : undefined,
      );
    });
  };

  const [compose, setCompose] = useState<{
    date: string;
    category: string;
    kind: ComposeKind;
  } | null>(null);
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
  // 셸이 view를 주면 그게 곧 탭 (#1138); 없으면 알약으로 스스로 전환한다.
  const [ownTab, setTab] = useState<'room' | 'calendar'>('room');
  const tab = view ?? ownTab;
  const [ownSelectedDate, setOwnSelectedDate] = useState(() => today);
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>('all');
  const selectedDate = controlledSelectedDate ?? ownSelectedDate;
  const dateRoutines = useMemo(
    () =>
      routines.filter(
        (r) =>
          isScheduledOn(r, selectedDate) &&
          (calendarFilter === 'all' || (r.kind ?? 'routine') === calendarFilter),
      ),
    [routines, selectedDate, calendarFilter],
  );
  // 참조 고정 (#771) — Calendar가 memo라, 매 렌더 새 함수면 42칸이 매번 다시 그려진다.
  const pickDate = useStableCallback((date: string) => {
    if (controlledSelectedDate === undefined) setOwnSelectedDate(date);
    onSelectedDateChange?.(date);
    if (date !== today) onSelectDate?.(date);
  });
  const catMeta = allCategories ?? categories;
  const serverBackedDay = !!onSelectDate && selectedDate !== today;
  const calendarTodayError = !serverBackedDay && loadError;
  const rawDayItems = serverBackedDay ? calendarDays?.[selectedDate] : undefined;
  const dayItems = useMemo(
    () => rawDayItems?.filter((item) => calendarFilter === 'all' || item.kind === calendarFilter),
    [rawDayItems, calendarFilter],
  );
  const selectedDay = localDate(selectedDate);
  const selectedDayLabel = monthDayLabel(selectedDay);
  const selectedWeekday = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][
    selectedDay.getDay()
  ];

  // 달력 서버 날짜에서 연 메뉴 — 완료 라벨/토글은 그 날의 기록과 달력 규칙
  // (미래 차단, 과거 허용)을 따른다 (#323).
  const menuCalItem =
    menuOpenId && serverBackedDay ? dayItems?.find((i) => i.id === menuOpenId) : undefined;
  const menuDone = menuCalItem
    ? menuCalItem.completed
    : menuRoutine
      ? isDone(menuRoutine.id, menuDate)
      : false;

  // 퀵애드 허용 규칙(#323·#626·#272)은 my-room/grouping — 참조 고정용 래퍼.
  const canQuickAdd = useCallback(
    (categoryId?: string) =>
      canQuickAddCategory(categoryId, categories, quickAddDisabledCategoryIds),
    [categories, quickAddDisabledCategoryIds],
  );

  // 달력 lists mirror the room tab's category sections — 그룹 규칙은
  // my-room/grouping. 클라이언트 날짜(오늘)와 서버 날짜가 각각의 함수.
  const calClientGroups = useMemo(
    () =>
      groupCalendarClientRoutines({
        routines: dateRoutines,
        categories,
        routineOrder,
        isDone: (id) => isDone(id, selectedDate),
        canQuickAdd,
      }),
    [categories, dateRoutines, routineOrder, isDone, selectedDate, canQuickAdd],
  );
  const calServerGroups = useMemo(
    () => groupCalendarServerItems({ dayItems, catMeta, categories, routineOrder, canQuickAdd }),
    [dayItems, catMeta, categories, routineOrder, canQuickAdd],
  );

  // 방 이미지 갤러리 저장 (#245) + 캡처 중 버튼 숨김 플래그 (#475) —
  // my-room/use-room-image-save. 위젯 캡처(아래)가 같은 ref·플래그를 쓴다.
  const { roomShotRef, capturing, setCapturing, onSaveRoomImage } = useRoomImageSave();

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
  const openCompose = (date: string, category = '') =>
    setCompose({
      date,
      category,
      kind: tab === 'calendar' && calendarFilter === 'todo' ? 'todo' : 'routine',
    });
  const renderQuickAddButton = (meta: RoutineCategoryMeta, date: string) =>
    canQuickAdd(meta.id) && !meta.deleted && meta.houseId == null ? (
      <ScalePressable
        onPress={() => openCompose(date, meta.id)}
        accessibilityRole="button"
        accessibilityLabel={`${meta.name}에 추가`}
        hitSlop={8}
        style={[styles.catAdd, { backgroundColor: meta.color }]}>
        <Icon name="add" size={14} color={t.onPrimary} />
      </ScalePressable>
    ) : null;

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
    /**
     * 행 키 — `${kind}-${routineId}`, 방 탭(오늘)·달력 클라이언트·달력 서버 세 경로가
     * **같은 루틴에 같은 키**를 쓴다 (#1207). 예전엔 클라이언트 경로가 맨 id, 서버
     * 경로가 `${kind}-${id}`라 달력 날짜만 바꿔도 전 행이 재마운트됐다.
     */
    key: string;
    /** 서버 루틴/투두 id — 드래그·재정렬·메뉴가 쓰는 id 공간. */
    routineId: string;
    title: string;
    done: boolean;
    /**
     * 롱프레스 재정렬 대상인가 — 미완료이고 루틴이 아직 살아 있을 때. 달력 서버
     * 날짜의 삭제된 루틴 기록은 옮길 곳이 없어(서버 no-op) 제외한다.
     */
    draggable: boolean;
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
    key: `${routine.kind ?? 'routine'}-${routine.id}`,
    routineId: routine.id,
    title: routine.title,
    done: isDone(routine.id, date),
    draggable: !isDone(routine.id, date),
    time: routine.alarmEnabled && routine.time ? routine.time : undefined,
    onToggle: (e) => handleToggle(routine, date, e),
    onMenu: () => openRowMenu(routine.id, date),
    // 메뉴 시트의 삭제하기와 같은 경로 — 스와이프는 지름길일 뿐이다 (#566).
    onDelete: onDeleteRoutine ? () => onDeleteRoutine(routine.id) : undefined,
  });

  const rowFromCalendarItem = (item: CalendarDayItem): RowSpec => {
    const live = routines.some((r) => r.id === item.id);
    return {
      repeats: item.kind === 'routine',
      key: `${item.kind}-${item.id}`,
      routineId: item.id,
      title: item.title,
      done: item.completed,
      // 살아 있는 루틴의 미완료 기록만 — 드래그는 그 루틴 자체를 옮긴다 (2026-09-08).
      draggable: live && !item.completed,
      time: item.time,
      onToggle: () => handleCalendarItemPress(item),
      // 기록만 남은(삭제된) 항목은 메뉴를 열 수 없다 — 그대로 표시만.
      onMenu: live ? () => openRowMenu(item.id, selectedDate) : undefined,
    };
  };

  /**
   * 행 핸들러 레지스트리 (#769) — RowSpec의 콜백은 매 렌더 새 클로저라 그대로
   * 넘기면 memo가 무효다. 렌더마다 이 맵만 갈아끼우고, 행에는 아래 참조 고정
   * 디스패처를 넘긴다. 행이 memo로 리렌더를 건너뛰어도 맵은 최신이라 낡은
   * 클로저를 잡지 않는다. 렌더 본문(renderCategoryGroup) 안에서 **동기적으로**
   * 비우고 다시 채우므로(#1207) 이벤트가 끼어들 틈이 없고, 이번 렌더에 없는 행의
   * 항목은 남지 않는다.
   */
  const rowHandlers = useConstant(() => new Map<string, { spec: RowSpec; categoryId?: string }>());

  // --- 루틴/투두 롱프레스 재정렬 (#716) ---
  // 미완료 행만 대상. 롱프레스로 들어 손가락을 따라가고, 놓으면 같은 카테고리면
  // 순서 변경(로컬), 다른 카테고리 그룹 위면 영구 이동(서버). 완료 행은 하단으로
  // 가라앉은 상태라 드래그에서 제외한다. 방 탭뿐 아니라 달력 탭의 모든 날짜에서도
  // 같은 의미다 (2026-09-08) — 서버 날짜의 행은 레지스트리의 routineId로 그 루틴
  // 자체를 옮기고, 순서는 카테고리 전역 순서(routineOrder)에 쓴다.
  const reorderEnabled = !!onReorderRoutines;
  const [dragId, setDragId] = useState<string | null>(null);
  const dragTY = useAnimatedValue(0);
  const rowRefs = useRef(new Map<string, View>());
  const dragSlotsRef = useRef<DragSlot[]>([]);
  const dropRef = useRef<DropTarget | null>(null);
  // 드래그 시작 시점의 카테고리별 미완료 id 순서 스냅샷 — 드롭 계산의 기준.
  const baseOrderRef = useRef<Map<string, string[]>>(new Map());

  // 인자는 행 키 (#1207) — dragId는 `active` 비교용이라 행 키 공간에 둔다.
  const beginDrag = useCallback(
    (rowKey: string) => {
      hapticSelection();
      setDragId(rowKey);
      // 기준 순서는 **지금 그려진 리스트**(방 탭 오늘 / 달력 오늘 / 달력 서버 날짜)의
      // 드래그 가능한 행 — 레지스트리는 렌더 순서대로 채워지므로 그대로 읽는다.
      // 카테고리 id는 그룹의 것(서버 날짜면 기록 당시 카테고리).
      const base = new Map<string, string[]>();
      const catById = new Map<string, string>();
      rowHandlers.forEach(({ spec, categoryId }) => {
        if (!spec.draggable || categoryId === undefined) return;
        base.set(categoryId, [...(base.get(categoryId) ?? []), spec.routineId]);
        catById.set(spec.routineId, categoryId);
      });
      baseOrderRef.current = base;
      // window 좌표 측정은 비동기 — 다음 프레임 안에 채워져 onUpdate가 쓴다
      // (집 좌석 드래그 #278와 같은 리프트 시점 측정).
      dragSlotsRef.current = [];
      rowRefs.current.forEach((node, key) => {
        // ref 맵은 행 키로 등록된다 — 슬롯은 루틴 id 공간이라 레지스트리로 되찾는다.
        const routineId = rowHandlers.get(key)?.spec.routineId;
        if (!routineId) return;
        node.measureInWindow((x, y, w, h) => {
          dragSlotsRef.current.push({
            routineId,
            categoryId: catById.get(routineId) ?? '',
            top: y,
            bottom: y + h,
          });
        });
      });
    },
    [rowHandlers],
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

  const registerRowRef = useCallback((rowKey: string, node: View | null) => {
    if (node) rowRefs.current.set(rowKey, node);
    else rowRefs.current.delete(rowKey);
  }, []);

  const dragIdRef = useLatestRef(dragId);
  /** 행 키 → 서버 루틴 id. 드래그 콜백은 행 키로 오지만 재정렬·이동은 루틴 id로 나간다. */
  const routineIdOf = (rowKey: string) => rowHandlers.get(rowKey)?.spec.routineId;
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
  const dispatchDragUpdate = useStableCallback((rowKey: string, absoluteY: number) => {
    const routineId = routineIdOf(rowKey);
    if (routineId !== undefined) updateDrop(routineId, absoluteY);
  });
  const dispatchDragEnd = useStableCallback((rowKey: string) => {
    const entry = rowHandlers.get(rowKey);
    if (entry?.categoryId !== undefined) endDrag(entry.spec.routineId, entry.categoryId);
  });
  const dispatchDragFinalize = useStableCallback((rowKey: string) => {
    if (dragIdRef.current !== rowKey) return;
    setDragId(null);
    dragTY.setValue(0);
  });

  // --- 카테고리 헤더 롱프레스 드래그 (2026-09-08) ---
  // 헤더를 꾹 눌러 끌면 그룹(헤더+행)이 통째로 들려 손가락을 따라가고, 놓으면
  // onReorderCategories(전체 카테고리 id 순서)로 서버 sortOrder를 바꾼다. 미분류('')는
  // 항상 꼬리라 들 수 없고 그 아래로 떨어질 수도 없다(resolveGroupDrop이 세지 않음).
  // 행 드래그와는 배타 — 한쪽이 활성이면 다른 쪽 제스처는 enabled=false.
  const categoryReorderEnabled = !!onReorderCategories;
  const [catDragId, setCatDragId] = useState<string | null>(null);
  const catDragTY = useAnimatedValue(0);
  /** 그룹 컨테이너 onLayout 사각형 — 카테고리 id 키, 부모(리스트 섹션) 기준. */
  const groupLayouts = useConstant(() => new Map<string, GroupSlot>());
  /** 이번 렌더에 그려진 그룹의 카테고리 id — 렌더 순서. 렌더마다 비우고 다시 채운다. */
  const groupOrder = useConstant(() => [] as string[]);
  /** 드래그 시작 시점의 이동 가능(실제 카테고리) 그룹 순서 스냅샷. */
  const catOrderRef = useRef<string[]>([]);
  const catDropRef = useRef<number | null>(null);
  const catDragIdRef = useLatestRef(catDragId);
  const categoriesRef = useLatestRef(categories);

  const isRealCategory = (id: string) => id !== '' && categories.some((c) => c.id === id);

  const dispatchCatDragStart = useStableCallback((categoryId: string) => {
    hapticSelection();
    setCatDragId(categoryId);
    catDropRef.current = null;
    const live = new Set(categoriesRef.current.map((c) => c.id));
    catOrderRef.current = groupOrder.filter((id) => id !== '' && live.has(id));
  });
  const dispatchCatDragUpdate = useStableCallback((categoryId: string, translationY: number) => {
    catDropRef.current = resolveGroupDrop(
      groupLayouts,
      catOrderRef.current,
      categoryId,
      translationY,
    );
  });
  const dispatchCatDragEnd = useStableCallback((categoryId: string) => {
    const index = catDropRef.current;
    catDropRef.current = null;
    setCatDragId(null);
    catDragTY.setValue(0);
    if (index === null) return;
    const order = catOrderRef.current;
    const next = reorderedIds(order, categoryId, index);
    // 구분자는 이스케이프 `\0` — 위 endDrag의 주석 참고.
    if (next.join('\0') === order.join('\0')) return;
    hapticSuccess();
    // 달력 서버 날짜엔 일부 카테고리가 안 그려질 수 있다 — 전체 순서에 되섞어 보낸다.
    onReorderCategories?.(
      mergeOrderedSubset(
        categoriesRef.current.map((c) => c.id),
        next,
      ),
    );
  });
  const dispatchCatDragFinalize = useStableCallback((categoryId: string) => {
    if (catDragIdRef.current !== categoryId) return;
    setCatDragId(null);
    catDragTY.setValue(0);
  });

  // 이번 렌더의 행만 남긴다 (#1207) — 아래 renderCategoryGroup이 같은 렌더 안에서
  // 동기적으로 다시 채운다. 지우지 않으면 지나간 날짜·삭제된 루틴의 항목이 영영 쌓였다.
  rowHandlers.clear();
  groupOrder.length = 0;

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
    groupOrder.push(meta.id);
    const catDraggable = categoryReorderEnabled && isRealCategory(meta.id) && dragId === null;
    const catActive = catDragId === meta.id;
    return (
      <Animated.View
        key={key}
        testID={`category-group-${meta.id || 'uncat'}`}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          groupLayouts.set(meta.id, { y, height });
        }}
        style={[
          styles.group,
          catActive
            ? { transform: [{ translateY: catDragTY }], zIndex: 20, elevation: 8, opacity: 0.96 }
            : null,
        ]}>
        <CategoryDragHandle
          categoryId={meta.id}
          draggable={catDraggable}
          dragTY={catDragTY}
          style={styles.catHeader}
          onDragStart={dispatchCatDragStart}
          onDragUpdate={dispatchCatDragUpdate}
          onDragEnd={dispatchCatDragEnd}
          onDragFinalize={dispatchCatDragFinalize}>
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
          {tab === 'room' && rows.length > 0 ? (
            <Text style={[Typography.supporting, { color: t.textDisabled }]}>
              {doneCount}/{rows.length}
            </Text>
          ) : null}
          <View style={styles.flex} />
          {renderQuickAddButton(meta, date)}
        </CategoryDragHandle>
        <View style={styles.rows}>
          {/* 카테고리 드래그 중엔 행 드래그를 끈다(배타) — 그룹이 통째로 들린 동안
              행이 따로 들리면 두 translateY가 겹친다. */}
          {rows.map((row) => {
            const draggable = reorderEnabled && row.draggable && catDragId === null;
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
        </View>
      </Animated.View>
    );
  };

  const renderScroll = (children: ReactNode) => (
    <PawRefreshScroll
      scrollRef={scrollRef}
      onRefresh={onRefresh}
      refreshTestID="my-room-refresh"
      // 재정렬 드래그 중엔 세로 스크롤을 잠근다 (#716) — 카테고리 드래그도 같다.
      scrollEnabled={dragId === null && catDragId === null}
      contentContainerStyle={[
        styles.body,
        // 달력은 상태바 바로 아래부터. 떠 있는 크롬 행(방/달력 알약, #1055)은 단독
        // 미리보기에만 있으니 그때만 그 높이만큼 내린다.
        split
          ? { paddingTop: insets.top + Spacing.four }
          : tab !== 'room'
            ? {
                paddingTop: insets.top + Spacing.two + (view === undefined ? CHROME_ROW_HEIGHT : 0),
              }
            : null,
        navInset ? { paddingBottom: Spacing.six + navInset } : null,
      ]}
      {...scrollRestore}
      keyboardShouldPersistTaps="handled">
      {children}
    </PawRefreshScroll>
  );
  // 2단(#1230): 왼쪽 고정 칸에 방 캔버스/달력, 오른쪽에 할 일 스크롤. 폰·좁은 창은
  // 종전대로 한 스크롤에 위아래로. hero/list는 두 배치가 같이 쓴다. **활성 탭의 것만**
  // 만든다 — renderCategoryGroup이 렌더마다 rowHandlers·groupOrder를 채우므로 두 탭의
  // 목록을 다 만들면 등록이 겹쳐 드래그 드롭 판정이 어긋난다.
  const hero =
    tab === 'room' ? (
      <View style={styles.roomWrap}>
        {!capturing ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.growthOverlay,
              {
                top:
                  (split ? 0 : insets.top) +
                  Spacing.two +
                  (view === undefined ? CHROME_ROW_HEIGHT + Spacing.two : 0),
              },
            ]}>
            <RoomGrowthPill
              growthLevel={growthLevel}
              growthPoints={growthPoints}
              pointsToNextLevel={pointsToNextLevel}
            />
          </View>
        ) : null}
        {/*
                    캡처 대상은 방 자체만 (#778) — 예전엔 ref가 패딩 있는
                    roomWrap에 붙어 있어 그 **투명 여백까지 찍혔고**, #744에서
                    캡처를 JPEG(알파 없음)로 바꾸면서 여백이 검정으로 눌러붙어
                    위젯에 검은 띠가 생겼다. 플로팅 버튼들은 roomWrap 기준
                    absolute라 바깥에 남겨도 위치가 그대로다.
                    전체화면(#1055): 방이 화면 폭을 다 쓰고 상태바 밑까지 올라간다 —
                    집 탭의 하늘처럼. 네 모서리 전부 각지게(아래도).
                  */}
        <View ref={roomShotRef} collapsable={false}>
          {/* 2단에서는 방이 칸 안의 카드라 계약 반경(16)을 되살린다. */}
          <Room
            {...roomScene}
            interactiveCharacter
            style={split ? undefined : styles.roomFullBleed}
          />
        </View>
        {/* 오른쪽 버튼 열 (#1055) — 메뉴·알림(헤더에서 이동)·꾸미기·뽑기.
                    방 이미지 저장 중에는 통째로 빼서 사진에서 제외한다 (#475).
                    opacity로 숨기면 글래스 면(#1050)이 안 그려지고 복귀가 불안정. */}
        {capturing ? null : (
          // 웹 데스크톱 2단(#1230 후속)에선 방 위 오버레이 대신 방 아래 한 줄 —
          // 왼쪽 칸이 비어 보이던 것을 채우고 방도 가리지 않는다. 폰은 종전 세로 열.
          <View style={split ? styles.btnRow : styles.btnColumn} testID="room-actions">
            <CoachTarget id="room-menu">
              <Pressable
                ref={menuBtnRef}
                onPress={openNavMenu}
                accessibilityRole="button"
                accessibilityLabel="메뉴"
                style={styles.floatBtn}>
                <GlassSurface style={styles.floatFace} fallbackColor={t.surface}>
                  <Icon name="menu" size={20} color={t.text} />
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
            {onOpenFurnitureStudio ? (
              <Pressable
                onPress={onOpenFurnitureStudio}
                accessibilityRole="button"
                accessibilityLabel="AI 가구 만들기"
                style={styles.floatBtn}>
                <GlassSurface style={styles.floatFace} fallbackColor={t.surface}>
                  <Icon name="sparkles" size={20} color={t.primaryText} />
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
    ) : (
      // monthSwipe=false 유지 (#825) — 달력 위 가로 스와이프가 월 이동이라는 또 다른
      // 뜻을 갖게 되면 "가로 스와이프 = 하단 탭 이동" 규칙이 다시 깨진다. 월 이동은 ‹ › 버튼.
      <View style={styles.calendarOverview}>
        <Calendar
          value={selectedDate}
          onSelect={pickDate}
          today={today}
          monthSwipe={false}
          markedDates={markedTodoDates}
          glass
          onVisibleMonthChange={onCalendarMonthChange}
          headerAccessory={
            <View style={styles.calendarFilters} accessibilityRole="tablist">
              {(['all', 'routine', 'todo'] as const).map((filter) => (
                <Pressable
                  key={filter}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: calendarFilter === filter }}
                  onPress={() => setCalendarFilter(filter)}
                  style={styles.calendarFilter}>
                  {calendarFilter === filter ? (
                    <GlassSurface
                      testID={`calendar-filter-glass-${filter}`}
                      pointerEvents="none"
                      fallbackColor={t.surface}
                      style={[StyleSheet.absoluteFill, styles.calendarFilterFace]}
                    />
                  ) : null}
                  <Text
                    style={[
                      Typography.label,
                      { color: calendarFilter === filter ? t.text : t.textMuted },
                    ]}>
                    {filter === 'all' ? '전체' : filter === 'routine' ? '루틴' : '할 일'}
                  </Text>
                </Pressable>
              ))}
            </View>
          }
        />
        {calendarMonthLoading ? (
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            이번 달 기록을 불러오는 중이에요
          </Text>
        ) : null}
        {calendarMonthError ? (
          <View style={styles.calendarState}>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              이번 달 기록을 새로 불러오지 못했어요
            </Text>
            <Pressable
              onPress={onRetryCalendarMonth}
              accessibilityRole="button"
              accessibilityLabel="월 기록 다시 불러오기"
              style={styles.calendarRetry}>
              <Text style={[Typography.label, { color: t.primaryText }]}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  // 폭 제한(#725)은 목록에만 — 방은 전체 폭 (#1055).
  const list =
    tab === 'room' ? (
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
                <Pressable
                  onPress={() => openCompose(today)}
                  accessibilityRole="button"
                  accessibilityLabel="오늘에 추가">
                  <GlassSurface fallbackColor={t.surface} style={styles.quickAddTrigger}>
                    <Icon name="add" size={22} color={t.text} />
                  </GlassSurface>
                </Pressable>
              </CoachTarget>
            </View>
          </View>
        </CoachTarget>

        {loading ? (
          <View style={styles.stateBlock}>
            <Loading />
            <Text style={[Typography.supporting, { color: t.textMuted }]}>불러오는 중...</Text>
          </View>
        ) : null}

        {!loading && loadError ? (
          <View style={styles.stateBlock}>
            <RetryState message="데이터를 불러오지 못했어요." onRetry={onRetry} />
          </View>
        ) : null}

        {!loading && !loadError && roomRoutines.length > 0 ? (
          <SpringProgressBar progress={progress} color={t.primary} trackColor={t.surfaceMuted} />
        ) : null}

        {loading || loadError
          ? null
          : roomGroups.map(({ meta: cat, items }) =>
              // Empty categories still render their header — the + quick-add
              // must stay reachable even before the first routine exists.
              // 미분류(id '')도 달력 탭처럼 이름 있는 키로 (#1207).
              renderCategoryGroup(
                cat.id || 'uncat',
                cat,
                items.map((r) => rowFromRoutine(r, today)),
                today,
              ),
            )}
      </View>
    ) : (
      <>
        <View style={styles.calListHead}>
          <View
            style={styles.calDateHeading}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${selectedDay.getFullYear()}년 ${selectedDayLabel} ${selectedWeekday}`}>
            <Text style={[Typography.h3, { color: t.text }]}>{selectedDayLabel}</Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>{selectedWeekday}</Text>
          </View>
          <View style={styles.sectionHeadRight}>
            <Pressable
              onPress={() => openCompose(selectedDate)}
              accessibilityRole="button"
              accessibilityLabel="선택한 날에 추가">
              <GlassSurface fallbackColor={t.surface} style={styles.quickAddTrigger}>
                <Icon name="add" size={22} color={t.text} />
              </GlassSurface>
            </Pressable>
          </View>
        </View>
        {calendarDayError || calendarTodayError ? (
          <View style={styles.calendarState}>
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              이 날의 기록을 새로 불러오지 못했어요
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="선택일 기록 다시 불러오기"
              onPress={calendarTodayError ? onRetry : onRetryCalendarDay}
              style={styles.calendarRetry}>
              <Text style={[Typography.label, { color: t.primaryText }]}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}
        {calendarTodayError ? null : loading ||
          (serverBackedDay && !dayItems && !calendarDayError) ? (
          <View style={styles.stateBlock}>
            <Loading />
          </View>
        ) : serverBackedDay && !dayItems ? null : serverBackedDay ? (
          calServerGroups!.length === 0 ? (
            <Text style={[Typography.body, styles.calEmpty, { color: t.textMuted }]}>
              {selectedDate < today ? '기록이 없어요' : '일정이 없어요'}
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
            {selectedDate < today ? '기록이 없어요' : '일정이 없어요'}
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
      </>
    );

  return (
    <View ref={rootRef} style={[styles.screen, useScreenStyle([])]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {split ? (
          <View style={styles.splitRow} testID="my-room-split">
            {/* 왼쪽 칸은 화면 세로 가운데에 고정(sticky) — 목록이 길어도 방·달력은 제자리.
                내용이 칸보다 크면(낮은 창) 그때만 자체 스크롤. 당김 새로고침은 목록 쪽에만. */}
            <ScrollView
              style={styles.splitHero}
              contentContainerStyle={[
                styles.splitHeroContent,
                {
                  paddingTop: insets.top + Spacing.four,
                  paddingBottom: Spacing.four + navInset,
                },
              ]}
              showsVerticalScrollIndicator={false}
              testID="my-room-split-hero">
              {hero}
            </ScrollView>
            <View style={styles.splitList}>
              {renderScroll(
                tab === 'room' ? list : <View style={[styles.calendarPanel, column]}>{list}</View>,
              )}
            </View>
          </View>
        ) : (
          renderScroll(
            tab === 'room' ? (
              <>
                {hero}
                {list}
              </>
            ) : (
              <View style={[styles.calendarPanel, column]}>
                {hero}
                {list}
              </View>
            ),
          )
        )}
      </KeyboardAvoidingView>

      {/* The room canvas has no title overlay, and the calendar tab has none either —
          the bottom tab already names it. Only the standalone preview's room/calendar
          switch lives here, outside the scroll view. */}
      {view === undefined ? (
        <View
          testID="my-room-chrome"
          pointerEvents="box-none"
          style={[styles.chromeRow, { top: insets.top + Spacing.two }]}>
          {/* 방/달력 알약은 view 미지정(단독 모드)에서만 — 앱에선 달력이 하단 탭 (#1138). */}
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
      ) : null}

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

      <RoutineTodoComposeSheet
        visible={compose !== null}
        initialDate={compose?.date ?? today}
        initialKind={compose?.kind ?? 'routine'}
        initialCategory={compose?.category ?? ''}
        today={today}
        categories={categories.filter((category) => canQuickAdd(category.id))}
        onSubmit={async (draft) => {
          let result: boolean | void;
          if (draft.kind === 'routine') {
            if (!onCreateRoutine) return false;
            result = await onCreateRoutine(draft.routine);
          } else {
            if (!onQuickAddRoutine) return false;
            result = draft.time
              ? await onQuickAddRoutine(draft.category, draft.title, draft.date, draft.time)
              : await onQuickAddRoutine(draft.category, draft.title, draft.date);
          }
          if (result !== false) {
            if (tab === 'calendar') {
              pickDate(draft.date);
              if (calendarFilter !== 'all' && calendarFilter !== draft.kind)
                setCalendarFilter(draft.kind);
            }
            if (draft.date !== today)
              toast(
                `${monthDayLabel(localDate(draft.date))}에 ${draft.kind === 'routine' ? '루틴' : '할 일'}을 추가했어요`,
              );
          }
          return result;
        }}
        onClose={() => setCompose(null)}
      />

      {/* Header hamburger popover: quick links to the management screens. */}
      <NavMenuPopover
        visible={navMenuOpen}
        top={navMenuTop}
        bottom={navMenuBottom}
        right={navMenuRight}
        onClose={() => setNavMenuOpen(false)}
        // 출석 이벤트·재화 내역은 내 정보 바로가기로 (#1055 → #1089) — 메뉴는 방 작업만.
        onOpenCharacterPicker={
          ownedCharacters && onSelectCharacter ? () => setCharacterSheetOpen(true) : undefined
        }
        onEditRoom={onEdit}
        // 웹은 view-shot이 없어 항목을 숨긴다 — 눌러서 '지원 안 함' 토스트를 보이는 것보다 낫다.
        onSaveRoomImage={Platform.OS === 'web' ? undefined : () => void onSaveRoomImage()}
        onOpenCategoryManager={() => onManageCategories?.()}
        // Routine management remains separate from the quick composer.
        onManageRoutines={onManageRoutines ?? onAddRoutine}
      />

      <CharacterPickerSheet
        visible={characterSheetOpen}
        characters={ownedCharacters ?? []}
        onSelect={(serverId) => onSelectCharacter?.(serverId)}
        onClose={() => setCharacterSheetOpen(false)}
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
  quickAddTrigger: {
    borderRadius: Radius.pill,
    padding: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  growthOverlay: { position: 'absolute', left: Spacing.four, zIndex: 3 },
  calendarOverview: { gap: Spacing.three },
  calendarFilters: { flexDirection: 'row', padding: Spacing.one, borderRadius: Radius.pill },
  calendarFilter: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    minHeight: 40,
    justifyContent: 'center',
  },
  calendarFilterFace: { borderRadius: Radius.pill },
  calendarState: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  calendarRetry: { padding: Spacing.two, minHeight: 44, justifyContent: 'center' },
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
  calDateHeading: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  // The selected date is the single heading for its list.
  calListHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
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
  // 2단 (#1230) — 왼쪽 칸은 폰 컬럼 폭, 오른쪽 목록이 남은 폭을 쓴다.
  // 2단 (#1230) — 왼쪽 칸은 폰 컬럼 폭, 오른쪽 목록은 콘텐츠 폭(560). 두 칸을 한 블록으로
  // 화면 가운데에 붙인다(투두메이트 비례) — 프레임 끝까지 벌리지 않는다.
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.six,
  },
  splitHero: {
    width: APP_FRAME_MAX_WIDTH,
    flexGrow: 0,
  },
  splitHeroContent: {
    paddingHorizontal: Spacing.four,
    // 세로 가운데 — flexGrow 1로 칸 높이를 채우고 내용을 중앙에 둔다. 내용이 더 크면
    // flexGrow가 무의미해져 위에서부터 스크롤된다.
    flexGrow: 1,
    justifyContent: 'center',
  },
  splitList: {
    width: ContentMaxWidth,
    flexShrink: 1,
  },

  // 전체화면 방 (#1055) — 위 모서리는 화면 가장자리에 붙으니 각지게.
  // 나의 방 전체화면(#1058)에서만 네 모서리 전부 각지게 — 아래 둥근 모서리가
  // '오늘의 할 일' 패널 경계와 어긋나 보였다(2026-09-08). 친구 방·꾸미기는 계약 반경 그대로.
  roomFullBleed: {
    borderRadius: 0,
  },
  // 오른쪽 버튼 열 (#1055) — 메뉴·알림·꾸미기·뽑기, 아래에서 위로.
  btnColumn: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.three,
    gap: Spacing.two,
  },
  // 2단 (#1230 후속) — 방 아래 가운데 한 줄. 같은 버튼·같은 순서(메뉴·알림·꾸미기·AI·뽑기).
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  floatBtn: {
    width: 44,
    height: 44,
  },
  // Calendar title on the left; the standalone preview switch stays on the right.
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
  segment: {
    marginLeft: 'auto',
    flexDirection: 'row',
    // 버튼을 감싼 래퍼(코치마크 대상 View)는 세로로 안 늘어나므로 행이 직접
    // 세로 중앙 정렬한다 — 없으면 비활성 라벨이 위로 붙는다 (#1055 후속).
    alignItems: 'center',
    height: CHROME_ROW_HEIGHT,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.pill,
  },
  segmentItem: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
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
