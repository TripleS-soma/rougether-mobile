import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
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
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { NavMenuPopover } from '@/components/app/nav-menu-popover';
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
import { Calendar } from '@/components/ui/calendar';
import { CoachTarget } from '@/components/ui/coach-mark';
import { CategoryIcon } from '@/components/ui/category-icon';
import { PawRefreshScroll } from '@/components/ui/paw-refresh-scroll';
import { Pictogram } from '@/components/ui/pictograms';
import { RetryState } from '@/components/ui/retry-state';
import { SpringProgressBar } from '@/components/ui/spring-progress';
import { useToast } from '@/components/ui/toast';
import { WalletPills } from '@/components/ui/wallet-pills';
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
import { BearCheck } from '@/components/ui/bear-check';
import { Icon } from '@/components/ui/icon';
import { ScalePressable } from '@/components/ui/scale-pressable';
import { Radius, Spacing } from '@/constants/theme';
// 인증사진형 잠시 내림 (#499) — 복구 시 카메라 캡처 import를 되살릴 것.
// import { captureVerificationPhoto } from '@/lib/photo-verify';
import { saveRoomImage } from '@/lib/room-capture';
import { captureRef } from 'react-native-view-shot';
import { refreshWidgets } from '@/widgets/rougether-widgets';
import { saveWidgetRoomImage } from '@/widgets/widget-data';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { readableTextColor } from '@/utils/color';
import { formatDate, formatTime, localDate, todayIso, weekdayOf } from '@/utils/datetime';
import { horizontalFlingGesture } from '@/utils/gesture';
import { hapticSelection, hapticSuccess } from '@/utils/haptics';

/**
 * Biweekly parity: scheduled on even week-distances from the startDate's week
 * (the server counts the startsOn week as week 1 and repeats every 2 weeks;
 * weeks anchor on Monday, matching KST server behavior).
 */
const inBiweeklyWeek = (dateIso: string, startIso: string) => {
  const mondayOf = (d: Date) => {
    const shifted = new Date(d);
    shifted.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return shifted;
  };
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const diff = mondayOf(localDate(dateIso)).getTime() - mondayOf(localDate(startIso)).getTime();
  return Math.round(diff / weekMs) % 2 === 0;
};

/**
 * Whether an item is scheduled on a date: todos by dueDate; routines by their
 * start/end range and repeat cadence (daily / weekly / biweekly / monthly /
 * yearly — same rules the server applies to /today and /calendar). Shared by
 * the 방 tab (today) and the 달력 tab (selected date) so both always agree.
 */
export const isScheduledOn = (r: Routine, dateIso: string) => {
  if (r.kind === 'todo') return r.dueDate === dateIso;
  if (r.startDate && dateIso < r.startDate) return false;
  if (r.endDate && dateIso > r.endDate) return false;
  const repeat = r.repeat ?? (r.days && r.days.length ? 'weekly' : 'daily');
  const [, month, day] = dateIso.split('-').map(Number);
  switch (repeat) {
    case 'weekly':
      return !r.days?.length || r.days.includes(weekdayOf(dateIso));
    case 'biweekly':
      return (
        (!r.days?.length || r.days.includes(weekdayOf(dateIso))) &&
        (!r.startDate || inBiweeklyWeek(dateIso, r.startDate))
      );
    case 'monthly':
      // A month without that date (31st + Feb) simply skips — no clamping.
      return r.dayOfMonth === day;
    case 'yearly':
      return r.month === month && r.dayOfMonth === day;
    default:
      return true;
  }
};

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

// RoomSceneProps: <Room />에 스프레드로 전달되는 씬 번들 (#691) — 내 방은
// 캐릭터가 항상 있으므로 characterId만 null 불가로 좁힌다.
export type MyRoomScreenProps = Omit<RoomSceneProps, 'characterId'> & {
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
  // 인증사진형 잠시 내림 (#499) — 복구 시 아래 prop을 되살릴 것.
  // /**
  //  * Capture a verification photo when completing a 인증사진형 routine; resolves to
  //  * the photo URI, or null to cancel the completion. Defaults to the device
  //  * camera (expo-image-picker); inject a stub in tests.
  //  */
  // onRequestPhoto?: () => Promise<string | null>;
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

/**
 * 루틴/할일 행 스와이프 삭제 (#566) — 왼쪽으로 밀면 빨간 '삭제' 액션이
 * 드러나고, **액션을 탭해야** 삭제 콜백이 나간다(파괴적 액션이라 풀스와이프
 * 즉시 삭제는 하지 않는다 — reveal + 탭 2단계). 삭제가 배선되지 않은 행
 * (달력 탭 서버 기반 항목 등)은 스와이프 없이 그대로 렌더.
 */
function SwipeDeleteRow({
  label,
  onDelete,
  children,
}: {
  label: string;
  onDelete?: () => void;
  children: ReactNode;
}) {
  const t = useTokens();
  const Typography = useTypography();
  const swipeRef = useRef<SwipeableMethods>(null);
  if (!onDelete) return children;
  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${label} 스와이프 삭제`}
          style={[styles.deleteAction, { backgroundColor: t.danger }]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>삭제</Text>
        </Pressable>
      )}>
      {children}
    </ReanimatedSwipeable>
  );
}

// memo 경계 (#539): 셸의 무관한 상태 변화에서 이 화면(그리고 안의 방 캔버스)
// 리렌더를 끊는다 — AppShell이 넘기는 함수/객체 prop의 참조 안정이 전제다.
export const MyRoomScreen = memo(function MyRoomScreen({
  userName = '준서',
  streakDays = 7,
  coinBalance = 0,
  diamondBalance = 0,
  characterId = DEFAULT_CHARACTER_ID,
  characterAnimations,
  wallpaperId = DEFAULT_WALLPAPER_ID,
  floorId,
  backgroundId,
  placedFurnitureIds,
  placements = null,
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
  // onRequestPhoto = captureVerificationPhoto, // 인증사진형 잠시 내림 (#499)
}: MyRoomScreenProps) {
  const t = useTokens();
  const Typography = useTypography();
  const headerInset = useHeaderInsetStyle();
  // 좁은 폰은 콤팩트 지갑 필(코인만) (#425) — 닉네임 열이 필 2개에 밀려
  // 뭉개지는 것 방지. 다이아는 뽑기 상점·꾸미기에서 보인다.

  // 코인 플라이 (#440) — 완료 탭 지점에서 헤더 지갑 필로 포물선 비행.
  const rootRef = useRef<View>(null);
  const walletRef = useRef<View>(null);
  const flyTarget = useRef({ x: 0, y: 0 });
  const walletPulse = useRef(new Animated.Value(1)).current;
  const coinSeq = useRef(0);
  const [flyingCoins, setFlyingCoins] = useState<
    { id: number; x: number; y: number; tx: number; ty: number }[]
  >([]);
  const measureWallet = () => {
    walletRef.current?.measureInWindow((x, y, w, h) => {
      flyTarget.current = { x: x + w / 2, y: y + h / 2 };
    });
  };
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
  const onCoinArrive = (id: number) => {
    setFlyingCoins((prev) => prev.filter((c) => c.id !== id));
    walletPulse.setValue(1.18);
    Animated.spring(walletPulse, { toValue: 1, friction: 3.5, useNativeDriver: true }).start();
  };

  // 스트릭 펄스 (#440) — 수치가 오르는 순간 🔥가 한 번 크게 일렁.
  const streakPulse = useRef(new Animated.Value(1)).current;
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
      const items = sinkDone(
        roomRoutines.filter((r) => {
          if (r.category === cat.id) return true;
          return isUncategorized && (!r.category || !knownIds.includes(r.category));
        }),
        (r) => isDone(r.id, today),
      );
      return { meta: cat, items };
    });
  }, [categories, roomRoutines, knownIds, sinkDone, isDone, today]);

  // Header hamburger popover (방 꾸미기 / 카테고리 관리 / 루틴 관리) + the
  // category manager sheet it opens. The popover anchors under the measured
  // button position — a fixed offset misaligns across notch/status-bar sizes.
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [navMenuTop, setNavMenuTop] = useState(104);
  const menuBtnRef = useRef<View>(null);
  const [characterSheetOpen, setCharacterSheetOpen] = useState(false);

  const openNavMenu = () => {
    setNavMenuOpen(true);
    // measureInWindow is a no-op in tests/web — the fallback top then applies.
    menuBtnRef.current?.measureInWindow?.((_x, y, _w, h) => {
      if (typeof y === 'number' && typeof h === 'number') setNavMenuTop(y + h + Spacing.one);
    });
  };

  // Which category's quick-add input is open, the in-progress todo text + due
  // date, and which routine's kebab menu is open.
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newTodo, setNewTodo] = useState('');
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
  const [tab, setTab] = useState<'room' | 'calendar'>('room');
  // 방↔달력 스와이프 순환 (#561 → 순환) — 방 캔버스(방 탭)·달력 영역
  // (달력 탭)의 가로 우세 플링만 두 서브탭을 오간다. '오늘의 루틴' 아래
  // 리스트 영역은 디텍터 밖이라 셸 탭 페이저(나의 방↔집)가 받는다 (#563
  // 후속). 달력 그리드는 monthSwipe=false라 월 이동 대신 여기로 흘러온다
  // (월 이동은 ‹ › 버튼). 세로 스크롤은 failOffsetY(±36)로 넘겨주고, 행
  // 스와이프(#560/#566)는 더 이른 활성 임계(±10)라 행 위 드래그를 먼저
  // 가져간다. 제스처는 마운트 시 1회 생성(재생성은 활성 팬을 취소시킨다 —
  // draggable-furniture 참고), 최신 tab은 핸들러 ref로 읽는다. 두 탭 분기가
  // 상호배타라 같은 제스처 객체를 양쪽 디텍터에 써도 동시 부착은 없다.
  const flingHandlerRef = useRef<() => void>(() => {});
  flingHandlerRef.current = () => setTab(tab === 'room' ? 'calendar' : 'room');
  const tabFling = useRef(
    horizontalFlingGesture('room-tab-fling', () => flingHandlerRef.current()),
  ).current;
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const dateRoutines = useMemo(
    () => routines.filter((r) => isScheduledOn(r, selectedDate)),
    [routines, selectedDate],
  );
  const pickDate = (date: string) => {
    setSelectedDate(date);
    if (date !== today) onSelectDate?.(date);
  };
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
    characterAnimations,
    wallpaperId,
    floorId,
    backgroundId,
    placedFurnitureIds,
    placements,
    furniture,
    wallpapers,
    floors,
    backgrounds,
  };

  // 홈 위젯용 무음 방 캡처 (#604, 안드로이드 전용) — 방 구성이 바뀌었을 때만
  // 잠깐 뽑기 버튼을 숨기고(기존 #475 플래그 재사용) data URI로 찍어 위젯
  // 저장소에 넘긴다. 시그니처 비교로 같은 방은 다시 찍지 않는다.
  const widgetShotSigRef = useRef('');
  const roomSignature = JSON.stringify({
    wallpaperId,
    floorId,
    backgroundId,
    placedFurnitureIds,
    placements,
    characterId,
  });
  useEffect(() => {
    // 홈 위젯이 있는 플랫폼만 (#604 안드, #606 iOS) — 웹은 캡처 제외.
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    if (widgetShotSigRef.current === roomSignature) return;
    // 로딩 중이거나 다른 캡처가 진행 중이면 다음 변화 때 다시 시도된다.
    if (loading || capturing) return;
    const timer = setTimeout(async () => {
      widgetShotSigRef.current = roomSignature;
      setCapturing(true);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      try {
        const dataUri = await captureRef(roomShotRef, {
          format: 'png',
          quality: 0.9,
          result: 'data-uri',
          width: 512,
          height: 512,
        });
        await saveWidgetRoomImage(dataUri);
        refreshWidgets();
      } catch {
        // 위젯은 부가 표면 — 실패 시 다음 방 변화 때 다시 찍는다.
        widgetShotSigRef.current = '';
      } finally {
        setCapturing(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [roomSignature, loading, capturing]);

  // Scroll the tapped category's quick-add input into view (above the keyboard).
  const scrollRef = useRef<ScrollView>(null);
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
    setNewTodo('');
    setNewTodoDate(defaultDate);
    const opening = addingCategory !== categoryId;
    setAddingCategory(opening ? categoryId : null);
    if (opening) {
      // First pass once the input has rendered (fast feedback); the effect
      // above does the authoritative pass after the keyboard + padding settle.
      setTimeout(scrollToQuickAdd, 80);
    }
  };

  const commitTodo = (categoryId: string) => {
    // Blur fired only to open the date picker → keep the input open.
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
    const title = newTodo.trim();
    // 새 행이 뚝 나타나는 대신 부드럽게 삽입되고 기존 행이 밀려난다 (#452).
    if (title) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (title) onQuickAddRoutine?.(categoryId, title, newTodoDate);
    setNewTodo('');
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
    <View ref={addRowRef} style={[styles.addRow, { backgroundColor: t.surface }]}>
      <BearCheck checked={false} size={22} />
      <TextInput
        ref={todoInputRef}
        autoFocus
        value={newTodo}
        onChangeText={setNewTodo}
        // Commit on blur — pressing 완료 (single-line blurs on submit) or
        // tapping elsewhere both save the todo.
        onBlur={() => commitTodo(categoryId)}
        placeholder="할 일 입력 후 완료"
        placeholderTextColor={t.textMuted}
        style={[styles.flex, styles.todoInput, { color: t.text }]}
      />
      <Pressable
        // onPressIn (fires before the input's blur) flags the blur as
        // picker-driven so the row stays open.
        onPressIn={() => {
          skipBlurCommit.current = true;
        }}
        onPress={() => setTodoDateOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="할 일 날짜 선택"
        style={[styles.dateChip, { backgroundColor: t.surfaceMuted }]}>
        <Icon name="calendar" size={13} color={t.textMuted} />
        <Text style={[Typography.supporting, { color: t.textMuted }]}>
          {newTodoDate === today ? '오늘' : formatDate(newTodoDate)}
        </Text>
      </Pressable>
    </View>
  );

  // Completion is toggled for a specific date (오늘 in 방, 선택한 날짜 in 달력).
  // (인증사진형 카메라 게이트는 잠시 내림 — #499, 아래 주석 블록.)
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
          if (result?.rewardAmount) launchCoinAt(flyFrom);
        });
      }
    };
    // 인증사진형 잠시 내림 (#499) — PHOTO 루틴도 일반 체크로 완료된다.
    // 복구 시 이 카메라 게이트를 되살릴 것 (사진은 서버 전송 없는 로컬 게이트).
    // if (routine.photoVerify && !done) {
    //   void onRequestPhoto().then((uri) => {
    //     if (uri) {
    //       hapticSuccess();
    //       fire();
    //     }
    //   });
    //   return;
    // }
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
    /** 사진 인증 루틴 — 카메라 배지. */
    photoVerify?: boolean;
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
    photoVerify: routine.photoVerify,
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

  const renderRoutineRow = (row: RowSpec, color: string) => (
    <SwipeDeleteRow key={row.key} label={row.title} onDelete={row.onDelete}>
      <View style={styles.routineRow}>
        {/* The checkbox alone toggles completion; the rest of the row opens the
          수정/삭제 bottom sheet. */}
        <BearCheck
          checked={row.done}
          color={color}
          onPress={(e) => row.onToggle(e)}
          accessibilityLabel={row.title}
        />
        <Pressable
          onPress={row.onMenu}
          accessibilityRole="button"
          accessibilityLabel={`${row.title} 메뉴`}
          style={[styles.flex, styles.rowBody]}>
          {/* 반복 마커(#576)는 제목과 같은 줄 — 아랫줄(알림 배지)에 두면
              시간까지 겹쳐 부제 줄이 길어진다. 긴 제목은 마커가 밀리지 않게
              한 줄로 잘라낸다. */}
          <View style={styles.titleRow}>
            <Text
              numberOfLines={1}
              style={[
                Typography.body,
                styles.titleText,
                row.done
                  ? { color: t.textMuted, textDecorationLine: 'line-through' }
                  : { color: t.text },
              ]}>
              {row.title}
            </Text>
            {row.repeats ? (
              <View testID="repeat-marker">
                <Icon name="refresh" size={12} color={t.textDisabled} />
              </View>
            ) : null}
          </View>
          {row.time ? (
            <View style={styles.badges}>
              {row.time ? (
                <View style={styles.badge}>
                  <Icon name="bell" size={12} color={t.textMuted} />
                  <Text style={[styles.badgeText, { color: t.textMuted }]}>
                    {formatTime(row.time)}
                  </Text>
                </View>
              ) : null}
              {/* 인증사진형 잠시 내림 (#499) — 복구 시 사진 인증 배지를 되살릴 것.
            {row.photoVerify ? (
              <View style={styles.badge}>
                <Icon name="camera" size={12} color={t.textMuted} />
                <Text style={[styles.badgeText, { color: t.textMuted }]}>사진 인증</Text>
              </View>
            ) : null} */}
            </View>
          ) : null}
        </Pressable>
      </View>
    </SwipeDeleteRow>
  );

  // 카테고리 그룹 = 헤더(아이콘·라벨·공개범위·카운트·＋) + 행들 + 퀵애드 입력행.
  // 빈 그룹도 헤더는 그린다 — ＋가 항상 닿아야 한다 (#323).
  const renderCategoryGroup = (
    key: string,
    meta: RoutineCategoryMeta,
    rows: RowSpec[],
    date: string,
  ) => {
    const doneCount = rows.filter((r) => r.done).length;
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
          {rows.map((row) => renderRoutineRow(row, meta.color))}
          {addingCategory === meta.id ? renderQuickAddRow(meta.id) : null}
        </View>
      </View>
    );
  };

  return (
    <View ref={rootRef} style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerName}>
            {/* Narrow phones: shrink the font (≥75%) first; if the title still
                overflows, middle-ellipsize so the 의 방 suffix stays visible. */}
            <Text
              style={[Typography.h3, { color: t.text }]}
              numberOfLines={1}
              ellipsizeMode="middle"
              adjustsFontSizeToFit
              minimumFontScale={0.75}>
              {userName}의 방
            </Text>
            {/* A 0-day streak is nothing to celebrate — show the flame only
                once a streak exists. */}
            {streakDays > 0 ? (
              <Animated.View style={[styles.streak, { transform: [{ scale: streakPulse }] }]}>
                <Icon name="flame" size={14} color={t.warningText} />
                <Text style={[Typography.supporting, { color: t.warningText }]}>
                  {streakDays}일
                </Text>
              </Animated.View>
            ) : null}
          </View>
        </View>
        <View style={styles.headerRight}>
          <Animated.View
            ref={walletRef}
            onLayout={measureWallet}
            style={{ transform: [{ scale: walletPulse }] }}>
            <WalletPills coin={coinBalance} diamond={diamondBalance} />
          </Animated.View>
          {/* 알림 lives inside this popover (#257 — a separate bell button
              crowded the header and crushed the title); unread shows as a dot
              on the menu button. */}
          <CoachTarget id="room-menu">
            <ScalePressable
              ref={menuBtnRef}
              onPress={openNavMenu}
              accessibilityRole="button"
              accessibilityLabel="메뉴"
              style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
              <Icon name="menu" size={20} color={t.text} />
              {onOpenNotifications && unreadNotificationCount > 0 ? (
                <View style={[styles.menuDot, { backgroundColor: t.danger }]} />
              ) : null}
            </ScalePressable>
          </CoachTarget>
        </View>
      </View>

      <View style={styles.tabBar}>
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
              style={[styles.tab, active && { borderBottomColor: t.primary }]}>
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
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <PawRefreshScroll
          scrollRef={scrollRef}
          onRefresh={onRefresh}
          refreshTestID="my-room-refresh"
          contentContainerStyle={[
            styles.body,
            addingCategory != null && keyboardPad > 0 ? { paddingBottom: keyboardPad + 120 } : null,
          ]}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled">
          {tab === 'room' ? (
            <>
              {/* 방↔달력 플링은 방 캔버스에서만 (#563 후속) — 아래 루틴
                    리스트 영역의 가로 스와이프는 셸 탭 페이저(집 이동) 몫. */}
              <GestureDetector gesture={tabFling}>
                <View style={styles.roomWrap} ref={roomShotRef} collapsable={false}>
                  <Room {...roomScene} interactiveCharacter />
                  <Pressable
                    onPress={onOpenGacha}
                    accessibilityRole="button"
                    accessibilityLabel="뽑기 상점"
                    // 방 이미지 저장 중에는 숨겨 사진에서 제외한다 (#475).
                    pointerEvents={capturing ? 'none' : 'auto'}
                    style={[
                      styles.gachaBtn,
                      { backgroundColor: t.surface },
                      capturing && styles.hidden,
                    ]}>
                    {/* absolute 버튼이라 래퍼 대신 내용을 측정 (#351). */}
                    <CoachTarget id="room-gacha">
                      <Icon name="gift" size={20} color={t.text} />
                    </CoachTarget>
                  </Pressable>
                </View>
              </GestureDetector>

              <View style={styles.section}>
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
                    <ActivityIndicator color={t.primary} />
                    <Text style={[Typography.supporting, { color: t.textMuted }]}>
                      불러오는 중…
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
            <View style={styles.calendarPanel}>
              <GestureDetector gesture={tabFling}>
                <View collapsable={false}>
                  <Calendar
                    value={selectedDate}
                    onSelect={pickDate}
                    today={today}
                    monthSwipe={false}
                  />
                </View>
              </GestureDetector>
              <View style={styles.calListHead}>
                <Text style={[Typography.h3, styles.calListTitle, { color: t.text }]}>
                  이 날의 루틴
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
                  <ActivityIndicator color={t.primary} />
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
        onClose={() => setNavMenuOpen(false)}
        onOpenNotifications={onOpenNotifications}
        notificationDot={unreadNotificationCount > 0}
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

/** 완료 탭 지점에서 지갑까지 포물선으로 나는 코인 (#440). */
function FlyingCoin({
  x,
  y,
  tx,
  ty,
  onDone,
}: {
  x: number;
  y: number;
  tx: number;
  ty: number;
  onDone: () => void;
}) {
  const t = useTokens();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, {
      toValue: 1,
      duration: 550,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => finished && onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회 발사
  }, []);
  // 정점은 출발·도착 중 높은 쪽보다 70px 위 — 포물선 궤적.
  const apexY = Math.min(y, ty) - 70;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flyCoin,
        {
          opacity: p.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [x, tx] }) },
            {
              translateY: p.interpolate({ inputRange: [0, 0.45, 1], outputRange: [y, apexY, ty] }),
            },
            { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
          ],
        },
      ]}>
      <Icon name="coin" size={18} color={t.warning} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
  },
  tab: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  calendarPanel: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  calListTitle: {
    marginTop: Spacing.three,
  },
  // 이 날의 루틴 제목 + 완료/총 카운트 행 (#346) — 방탭 sectionHead와 같은 결.
  calListHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  calEmpty: {
    paddingVertical: Spacing.three,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginRight: Spacing.two,
  },
  headerName: {
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  body: {
    paddingBottom: Spacing.six,
  },
  roomWrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  gachaBtn: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.three,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 방 이미지 저장 캡처 중 뽑기 버튼을 투명 처리해 사진에서 제외 (#475).
  hidden: {
    opacity: 0,
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
  flyCoin: {
    position: 'absolute',
    left: -9,
    top: -9,
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catAdd: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: {
    gap: 0,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    // 부제 줄(사진 인증·알림) 있는 행 높이(≈48)에 맞춘 고정 리듬 (#392) —
    // 부제 없는 행에서 곰 체크(귀 포함 ~30px)가 행을 꽉 채우지 않게 한다.
    minHeight: 48,
  },
  rowBody: {
    paddingVertical: Spacing.one,
  },
  // 제목 + 반복 마커 한 줄 (#576) — 마커는 제목 바로 옆, 제목이 길면 잘린다.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  titleText: {
    flexShrink: 1,
  },
  // 스와이프 삭제 액션 (#566) — 행 오른쪽에 드러나는 빨간 버튼.
  deleteAction: {
    width: Spacing.six,
    marginLeft: Spacing.two,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same width as catDot so checkboxes center under the category emoji and
  // row titles line up with the category label.
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    marginTop: Spacing.half,
  },
  todoInput: {
    fontSize: 18,
    paddingVertical: Spacing.three,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  center: {
    textAlign: 'center',
  },
  stateBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  badgeText: {
    fontSize: 13,
  },
});
