import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CharacterAvatar, type CharacterAnimationSet } from '@/components/character-avatar';
import { Room } from '@/components/room/room';
import { CategoryManagerSheet } from '@/components/screens/sheets/category-manager-sheet';
import {
  CharacterPickerSheet,
  type OwnedCharacter,
} from '@/components/screens/sheets/character-picker-sheet';
import { TimePickerSheet } from '@/components/screens/sheets/time-picker-sheet';
import { Calendar } from '@/components/ui/calendar';
import { Pictogram } from '@/components/ui/pictograms';
import { useToast } from '@/components/ui/toast';
import { WalletPills } from '@/components/ui/wallet-pills';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import {
  type CategoryVisibility,
  ROUTINE_CATEGORIES,
  type Routine,
  type RoutineCategoryMeta,
  UNCATEGORIZED_META,
  VISIBILITY_ICONS,
  VISIBILITY_LABELS,
} from '@/constants/routines';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { captureVerificationPhoto } from '@/lib/photo-verify';
import { saveRoomImage } from '@/lib/room-capture';
import {
  DEFAULT_WALLPAPER_ID,
  type FurnitureItem,
  type PlacedFurniture,
  type Wallpaper,
} from '@/resources/furniture';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import { readableTextColor } from '@/utils/color';
import { formatDate, formatTime, todayIso } from '@/utils/datetime';
import { hapticSelection, hapticSuccess } from '@/utils/haptics';

/** Weekday (0 = Sun) of a local "YYYY-MM-DD" date. */
const weekdayOf = (dateIso: string) => {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

/** Local Date at midnight from "YYYY-MM-DD". */
const localDate = (dateIso: string) => {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

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
const isScheduledOn = (r: Routine, dateIso: string) => {
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

export type MyRoomScreenProps = {
  /** Room occupant's display name (header title becomes "{userName}의 방"). */
  userName?: string;
  /** Consecutive-day streak shown in the header. */
  streakDays?: number;
  /** Wallet balances shown in the header (완료 보상 피드백의 기준점). */
  coinBalance?: number;
  diaBalance?: number;
  // Room rendering (forwarded to <Room />).
  characterId?: CharacterId;
  /** Worn character's CDN animation keys (forwarded to <Room />). */
  characterAnimations?: CharacterAnimationSet;
  wallpaperId?: string;
  floorId?: string | null;
  backgroundId?: string | null;
  placedFurnitureIds?: string[];
  /** 자유 배치(FREE_V1, #327) — 주어지면 슬롯 대신 정규화 좌표로 렌더. */
  placements?: PlacedFurniture[] | null;
  furniture?: FurnitureItem[];
  wallpapers?: Wallpaper[];
  floors?: Wallpaper[];
  backgrounds?: Wallpaper[];
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
  /** Create a category (햄버거 메뉴 → 카테고리 관리 sheet). */
  onCreateCategory?: (category: RoutineCategoryMeta) => void;
  onUpdateCategory?: (id: string, category: RoutineCategoryMeta) => void;
  /** Delete a category (카테고리 관리 sheet). */
  onDeleteCategory?: (id: string) => void;
  /** Persist a new category order (카테고리 관리 sheet, long-press to move). */
  onReorderCategories?: (orderedIds: string[]) => void;
  /** Toggle a routine's completion on a specific date ("YYYY-MM-DD"). */
  onToggleCompletion?: (id: string, date: string) => void;
  onOpenGacha?: () => void;
  /** Quick-add a todo to a category with a due date (the + on a category header). */
  onQuickAddRoutine?: (category: string, title: string, dueDate: string) => void;
  /**
   * Categories whose quick-add(+) is hidden — 공동미션 연동 카테고리는 미션의
   * + 버튼으로만 항목이 생겨야 하므로 임의 투두 추가를 막는다 (#272).
   */
  quickAddDisabledCategoryIds?: string[];
  /** Rename a routine (kebab → 수정: name only; full edit lives in 루틴 관리). */
  onRenameRoutine?: (id: string, title: string) => void;
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
   * Capture a verification photo when completing a 인증사진형 routine; resolves to
   * the photo URI, or null to cancel the completion. Defaults to the device
   * camera (expo-image-picker); inject a stub in tests.
   */
  onRequestPhoto?: () => Promise<string | null>;
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

export function MyRoomScreen({
  userName = '준서',
  streakDays = 7,
  coinBalance = 0,
  diaBalance = 0,
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
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  onToggleCompletion,
  onOpenGacha,
  onQuickAddRoutine,
  quickAddDisabledCategoryIds = [],
  onRenameRoutine,
  onUpdateRoutineTime,
  onUpdateTodoDueDate,
  onMoveRoutineOccurrence,
  onDeleteRoutine,
  onRequestPhoto = captureVerificationPhoto,
}: MyRoomScreenProps) {
  const t = useTokens();
  const headerInset = useHeaderInsetStyle();
  const { show: toast } = useToast();
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  const knownIds = categories.map((c) => c.id);

  const today = todayIso();
  const isDone = (id: string, date: string) => (completions[id] ?? []).includes(date);
  // Checked items sink below unchecked ones within their category (stable in
  // each half), keeping the remaining work on top of every list.
  const sinkDone = <T,>(items: T[], done: (item: T) => boolean): T[] => [
    ...items.filter((i) => !done(i)),
    ...items.filter(done),
  ];
  // Categories that still hold routines/todos — the manager sheet blocks their
  // deletion with a warning (the server refuses it anyway).
  const inUseCategoryIds = Array.from(
    new Set(routines.map((r) => r.category).filter((c): c is string => !!c)),
  );

  // The 방 tab lists only what's scheduled *today* (repeat days + start/end
  // range) — the same rule the 달력 tab applies to its selected date. Without
  // this, editing a routine's days never changed the today list.
  const roomRoutines = routines.filter((r) => isScheduledOn(r, today));
  const completedCount = roomRoutines.filter((r) => isDone(r.id, today)).length;
  const progress = roomRoutines.length > 0 ? completedCount / roomRoutines.length : 0;

  // Routines with a missing/unknown category land in the last group; with no
  // categories at all, render a single pseudo-group so they stay visible
  // (routines can exist without any category, e.g. after a category delete).
  // A truly empty account shows just the guided empty state instead.
  const groups =
    categories.length > 0 ? categories : roomRoutines.length > 0 ? [UNCATEGORIZED_META] : [];

  // Header hamburger popover (방 꾸미기 / 카테고리 관리 / 루틴 관리) + the
  // category manager sheet it opens. The popover anchors under the measured
  // button position — a fixed offset misaligns across notch/status-bar sizes.
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [navMenuTop, setNavMenuTop] = useState(104);
  const menuBtnRef = useRef<View>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
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
  // 시간이 없는 루틴/투두는 '시간 추가', 있으면 '시간 수정' (#325).
  const menuTimeLabel = menuRoutine?.alarmEnabled && menuRoutine?.time ? '시간 수정' : '시간 추가';
  const openRowMenu = (id: string, date = today) => {
    setMenuDate(date);
    setMenuOpenId(id);
  };

  // Kebab → 수정: rename only (id + draft text). Kebab → 시간 수정: TimePickerSheet.
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [timeId, setTimeId] = useState<string | null>(null);
  const timeRoutine = routines.find((r) => r.id === timeId) ?? null;
  // 메뉴 → 날짜 바꾸기: calendar sheet. Todos move their dueDate; routines move
  // that day's occurrence only (repeat stays). The pick is a draft until 확인.
  const [dateEditId, setDateEditId] = useState<string | null>(null);
  const dateEditItem = routines.find((r) => r.id === dateEditId) ?? null;
  const [dateDraft, setDateDraft] = useState(today);

  // 방 / 달력 tab. The calendar lists routines + todos on the selected date.
  // Today renders from live client state (toggleable); other dates render the
  // server /calendar list, where only past todos toggle — future dates can't
  // be completed, routines accept today-only logs server-side, and past
  // records keep their original (possibly deleted) category.
  const [tab, setTab] = useState<'room' | 'calendar'>('room');
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const dateRoutines = routines.filter((r) => isScheduledOn(r, selectedDate));
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
  const canQuickAdd = (categoryId?: string) =>
    !!categoryId &&
    categories.some((c) => c.id === categoryId) &&
    !quickAddDisabledCategoryIds.includes(categoryId);

  // 달력 lists mirror the room tab's category sections (emoji + colored label
  // + done count). Empty groups still render when they can quick-add — the +
  // must stay reachable on any date, like the room tab (#323).
  const calGroupsBase =
    categories.length > 0 ? categories : dateRoutines.length > 0 ? [UNCATEGORIZED_META] : [];
  const calClientGroups = calGroupsBase
    .map((cat, idx) => {
      const isFallback = idx === calGroupsBase.length - 1;
      const items = dateRoutines.filter(
        (r) =>
          r.category === cat.id || (isFallback && (!r.category || !knownIds.includes(r.category))),
      );
      return { meta: cat, items: sinkDone(items, (r) => isDone(r.id, selectedDate)) };
    })
    .filter((g) => g.items.length > 0 || canQuickAdd(g.meta.id));
  // Server days group by the record-time categoryId (kept in server order:
  // categoryId asc, 미분류 last); deleted categories resolve via catMeta.
  const calServerGroups = dayItems
    ? (() => {
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
      })()
    : undefined;

  // 방 뷰 캡처 대상 (#245) — 갤러리 저장은 네이티브 전용.
  const roomShotRef = useRef<View>(null);
  const onSaveRoomImage = async () => {
    const result = await saveRoomImage(roomShotRef);
    if (result === 'saved') toast('방 이미지를 갤러리에 저장했어요', 'success');
    else if (result === 'denied') toast('사진 접근 권한을 허용해주세요', 'error');
    else if (result === 'unsupported') toast('웹에서는 이미지 저장을 지원하지 않아요', 'error');
    else toast('이미지 저장에 실패했어요', 'error');
  };

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
    if (title) onQuickAddRoutine?.(categoryId, title, newTodoDate);
    setNewTodo('');
    setAddingCategory(null);
  };

  // 카테고리 헤더의 + 버튼 — 방탭·달력탭 공용 (#323).
  const renderQuickAddButton = (meta: RoutineCategoryMeta, defaultDate: string) =>
    canQuickAdd(meta.id) ? (
      <Pressable
        onPress={() => openQuickAdd(meta.id, defaultDate)}
        accessibilityRole="button"
        accessibilityLabel={`${meta.label} 할 일 추가`}
        hitSlop={8}
        style={[styles.catAdd, { backgroundColor: meta.color }]}>
        <Icon name="add" size={14} color={t.onPrimary} />
      </Pressable>
    ) : null;

  // 퀵애드 입력행 — 제목 입력 + 마감일 칩, blur가 커밋. 방탭·달력탭 공용 (#323).
  const renderQuickAddRow = (categoryId: string) => (
    <View ref={addRowRef} style={[styles.addRow, { backgroundColor: t.surface }]}>
      <Icon name="checkbox-off" size={22} color={t.textDisabled} />
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
        <Text style={[styles.dateChipText, { color: t.textMuted }]}>
          {newTodoDate === today ? '오늘' : formatDate(newTodoDate)}
        </Text>
      </Pressable>
    </View>
  );

  // Completing a 인증사진형 routine first requires a camera photo; if none is
  // captured (cancelled / denied), the completion is aborted. Kept sync on the
  // common (non-photo) path; only the photo path awaits the camera. Completion
  // is toggled for a specific date (오늘 in 방, 선택한 날짜 in 달력).
  const handleToggle = (routine: Routine, date: string) => {
    const done = isDone(routine.id, date);
    if (routine.photoVerify && !done) {
      void onRequestPhoto().then((uri) => {
        if (uri) {
          hapticSuccess();
          onToggleCompletion?.(routine.id, date);
        }
      });
      return;
    }
    if (done) hapticSelection();
    else hapticSuccess();
    onToggleCompletion?.(routine.id, date);
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

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatar, { backgroundColor: character.bg }]}>
            <CharacterAvatar characterId={characterId} size={36} />
          </View>
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
              <View style={styles.streak}>
                <Icon name="flame" size={14} color={t.warningText} />
                <Text style={[Typography.supporting, { color: t.warningText }]}>
                  {streakDays}일
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.headerRight}>
          <WalletPills coin={coinBalance} dia={diaBalance} />
          {/* 알림 lives inside this popover (#257 — a separate bell button
              crowded the header and crushed the title); unread shows as a dot
              on the menu button. */}
          <Pressable
            ref={menuBtnRef}
            onPress={openNavMenu}
            accessibilityRole="button"
            accessibilityLabel="메뉴"
            style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
            <Icon name="menu" size={20} color={t.text} />
            {onOpenNotifications && unreadNotificationCount > 0 ? (
              <View style={[styles.menuDot, { backgroundColor: t.danger }]} />
            ) : null}
          </Pressable>
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
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && { borderBottomColor: t.primary }]}>
              <Text style={[Typography.label, { color: active ? t.primaryText : t.textMuted }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.body,
            addingCategory && keyboardPad > 0 ? { paddingBottom: keyboardPad + 120 } : null,
          ]}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled">
          {tab === 'room' ? (
            <>
              <View style={styles.roomWrap} ref={roomShotRef} collapsable={false}>
                <Room
                  characterId={characterId}
                  characterAnimations={characterAnimations}
                  wallpaperId={wallpaperId}
                  floorId={floorId}
                  backgroundId={backgroundId}
                  placedFurnitureIds={placedFurnitureIds}
                  placements={placements}
                  furniture={furniture}
                  wallpapers={wallpapers}
                  floors={floors}
                  backgrounds={backgrounds}
                  interactiveCharacter
                />
                <Pressable
                  onPress={onOpenGacha}
                  accessibilityRole="button"
                  accessibilityLabel="뽑기 상점"
                  style={[styles.gachaBtn, { backgroundColor: t.surface }]}>
                  <Icon name="gift" size={20} color={t.text} />
                </Pressable>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={[Typography.h2, { color: t.text }]}>오늘의 루틴</Text>
                  <View style={styles.sectionHeadRight}>
                    {roomRoutines.length > 0 ? (
                      <Text style={[Typography.label, { color: t.primaryText }]}>
                        {completedCount} / {roomRoutines.length}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={onAddRoutine}
                      accessibilityRole="button"
                      accessibilityLabel="루틴 추가"
                      style={[styles.addBtn, { backgroundColor: t.primary }]}>
                      <Icon name="add" size={18} color={t.onPrimary} />
                    </Pressable>
                  </View>
                </View>

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
                    <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
                      데이터를 불러오지 못했어요.
                    </Text>
                    <Pressable
                      onPress={onRetry}
                      accessibilityRole="button"
                      accessibilityLabel="다시 시도"
                      style={[styles.retryBtn, { backgroundColor: t.primary }]}>
                      <Text style={[Typography.label, { color: t.onPrimary }]}>다시 시도</Text>
                    </Pressable>
                  </View>
                ) : null}

                {!loading && !loadError && roomRoutines.length > 0 ? (
                  <View style={[styles.progressTrack, { backgroundColor: t.surfaceMuted }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { backgroundColor: t.primary, width: `${progress * 100}%` },
                      ]}
                    />
                  </View>
                ) : null}

                {!loading && !loadError && categories.length === 0 && roomRoutines.length === 0 ? (
                  <View style={styles.stateBlock}>
                    <Text style={[Typography.body, styles.center, { color: t.textMuted }]}>
                      아직 루틴이 없어요.
                    </Text>
                    <View style={styles.emptyHintRow}>
                      <Icon name="add" size={16} color={t.textMuted} />
                      <Text style={[Typography.supporting, styles.center, { color: t.textMuted }]}>
                        위의 + 버튼으로 첫 루틴을 만들어보세요.
                      </Text>
                    </View>
                  </View>
                ) : null}

                {loading || loadError
                  ? null
                  : groups.map((cat, idx) => {
                      const isFallback = idx === groups.length - 1;
                      const items = sinkDone(
                        roomRoutines.filter((r) => {
                          if (r.category === cat.id) return true;
                          return isFallback && (!r.category || !knownIds.includes(r.category));
                        }),
                        (r) => isDone(r.id, today),
                      );
                      // Empty categories still render their header — the + quick-add
                      // must stay reachable even before the first routine exists.
                      const doneInCat = items.filter((r) => isDone(r.id, today)).length;

                      return (
                        <View key={cat.id} style={styles.group}>
                          <View style={styles.catHeader}>
                            <View style={[styles.catDot, { backgroundColor: `${cat.color}33` }]}>
                              <Pictogram name={cat.icon} size={14} />
                            </View>
                            <Text
                              style={[
                                Typography.label,
                                { color: readableTextColor(cat.color, t.surfaceMuted) },
                              ]}>
                              {cat.label}
                            </Text>
                            {/* 미분류(pseudo) 그룹은 실제 카테고리가 아니라 표시하지 않는다. */}
                            {cat.id ? <VisibilityMark visibility={cat.visibility} /> : null}
                            {items.length > 0 ? (
                              <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                                {doneInCat}/{items.length}
                              </Text>
                            ) : null}
                            <View style={styles.flex} />
                            {renderQuickAddButton(cat, today)}
                          </View>

                          <View style={styles.rows}>
                            {/* The checkbox alone toggles completion; the rest
                                of the row opens the 수정/삭제 bottom sheet (the
                                old kebab's menu — the kebab itself is gone). */}
                            {items.map((routine) => {
                              const done = isDone(routine.id, today);
                              return (
                                <View key={routine.id}>
                                  <View style={styles.routineRow}>
                                    <Pressable
                                      onPress={() => handleToggle(routine, today)}
                                      accessibilityRole="checkbox"
                                      accessibilityState={{ checked: done }}
                                      accessibilityLabel={routine.title}
                                      hitSlop={8}
                                      style={[styles.leadIcon, styles.checkbox]}>
                                      <Icon
                                        name={done ? 'checkbox-on' : 'checkbox-off'}
                                        size={22}
                                        color={done ? cat.color : t.textDisabled}
                                      />
                                    </Pressable>
                                    <Pressable
                                      onPress={() => openRowMenu(routine.id)}
                                      accessibilityRole="button"
                                      accessibilityLabel={`${routine.title} 메뉴`}
                                      style={[styles.flex, styles.rowBody]}>
                                      <Text
                                        style={[
                                          Typography.body,
                                          done
                                            ? {
                                                color: t.textMuted,
                                                textDecorationLine: 'line-through',
                                              }
                                            : { color: t.text },
                                        ]}>
                                        {routine.title}
                                      </Text>
                                      {(routine.alarmEnabled && routine.time) ||
                                      routine.photoVerify ? (
                                        <View style={styles.badges}>
                                          {routine.alarmEnabled && routine.time ? (
                                            <View style={styles.badge}>
                                              <Icon name="bell" size={12} color={t.textMuted} />
                                              <Text
                                                style={[styles.badgeText, { color: t.textMuted }]}>
                                                {formatTime(routine.time)}
                                              </Text>
                                            </View>
                                          ) : null}
                                          {routine.photoVerify ? (
                                            <View style={styles.badge}>
                                              <Icon name="camera" size={12} color={t.textMuted} />
                                              <Text
                                                style={[styles.badgeText, { color: t.textMuted }]}>
                                                사진 인증
                                              </Text>
                                            </View>
                                          ) : null}
                                        </View>
                                      ) : null}
                                    </Pressable>
                                  </View>
                                </View>
                              );
                            })}

                            {addingCategory === cat.id ? renderQuickAddRow(cat.id) : null}
                          </View>
                        </View>
                      );
                    })}
              </View>
            </>
          ) : (
            <View style={styles.calendarPanel}>
              <Calendar value={selectedDate} onSelect={pickDate} />
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
                <View style={[styles.progressTrack, { backgroundColor: t.surfaceMuted }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: t.primary, width: `${(calDayDone / calDayTotal) * 100}%` },
                    ]}
                  />
                </View>
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
                  calServerGroups!.map((group, gi) => (
                    <View key={group.meta.id || `etc-${gi}`} style={styles.group}>
                      <View style={styles.catHeader}>
                        <View style={[styles.catDot, { backgroundColor: `${group.meta.color}33` }]}>
                          <Pictogram name={group.meta.icon} size={14} />
                        </View>
                        <Text
                          style={[
                            Typography.label,
                            { color: readableTextColor(group.meta.color, t.surfaceMuted) },
                          ]}>
                          {group.meta.label}
                        </Text>
                        {group.meta.id ? (
                          <VisibilityMark visibility={group.meta.visibility} />
                        ) : null}
                        {group.items.length > 0 ? (
                          <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                            {group.items.filter((i) => i.completed).length}/{group.items.length}
                          </Text>
                        ) : null}
                        <View style={styles.flex} />
                        {renderQuickAddButton(group.meta, selectedDate)}
                      </View>
                      {addingCategory === group.meta.id ? renderQuickAddRow(group.meta.id) : null}
                      {group.items.map((item) => (
                        <View key={`${item.kind}-${item.id}`} style={styles.routineRow}>
                          <Pressable
                            onPress={() => handleCalendarItemPress(item)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: item.completed }}
                            accessibilityLabel={item.title}
                            hitSlop={8}
                            style={[styles.leadIcon, styles.checkbox]}>
                            <Icon
                              name={item.completed ? 'checkbox-on' : 'checkbox-off'}
                              size={22}
                              color={item.completed ? group.meta.color : t.textDisabled}
                            />
                          </Pressable>
                          <Pressable
                            // 기록만 남은(삭제된) 항목은 메뉴를 열 수 없다 — 그대로 표시만.
                            onPress={
                              routines.some((r) => r.id === item.id)
                                ? () => openRowMenu(item.id, selectedDate)
                                : undefined
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`${item.title} 메뉴`}
                            style={[styles.flex, styles.rowBody]}>
                            <Text
                              style={[
                                Typography.body,
                                item.completed
                                  ? { color: t.textMuted, textDecorationLine: 'line-through' }
                                  : { color: t.text },
                              ]}>
                              {item.title}
                            </Text>
                            {item.time ? (
                              <View style={styles.badge}>
                                <Icon name="bell" size={12} color={t.textMuted} />
                                <Text style={[styles.badgeText, { color: t.textMuted }]}>
                                  {formatTime(item.time)}
                                </Text>
                              </View>
                            ) : null}
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ))
                )
              ) : calClientGroups.length === 0 ? (
                <Text style={[Typography.body, styles.calEmpty, { color: t.textMuted }]}>
                  예정된 루틴이 없어요.
                </Text>
              ) : (
                calClientGroups.map((group, gi) => (
                  <View key={group.meta.id || `etc-${gi}`} style={styles.group}>
                    <View style={styles.catHeader}>
                      <View style={[styles.catDot, { backgroundColor: `${group.meta.color}33` }]}>
                        <Pictogram name={group.meta.icon} size={14} />
                      </View>
                      <Text
                        style={[
                          Typography.label,
                          { color: readableTextColor(group.meta.color, t.surfaceMuted) },
                        ]}>
                        {group.meta.label}
                      </Text>
                      {group.meta.id ? <VisibilityMark visibility={group.meta.visibility} /> : null}
                      {group.items.length > 0 ? (
                        <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                          {group.items.filter((r) => isDone(r.id, selectedDate)).length}/
                          {group.items.length}
                        </Text>
                      ) : null}
                      <View style={styles.flex} />
                      {renderQuickAddButton(group.meta, selectedDate)}
                    </View>
                    {addingCategory === group.meta.id ? renderQuickAddRow(group.meta.id) : null}
                    {group.items.map((routine) => {
                      const done = isDone(routine.id, selectedDate);
                      return (
                        <View key={routine.id} style={styles.routineRow}>
                          <Pressable
                            onPress={() => handleToggle(routine, selectedDate)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: done }}
                            accessibilityLabel={routine.title}
                            hitSlop={8}
                            style={[styles.leadIcon, styles.checkbox]}>
                            <Icon
                              name={done ? 'checkbox-on' : 'checkbox-off'}
                              size={22}
                              color={done ? group.meta.color : t.textDisabled}
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => openRowMenu(routine.id, selectedDate)}
                            accessibilityRole="button"
                            accessibilityLabel={`${routine.title} 메뉴`}
                            style={[styles.flex, styles.rowBody]}>
                            <Text
                              style={[
                                Typography.body,
                                done
                                  ? { color: t.textMuted, textDecorationLine: 'line-through' }
                                  : { color: t.text },
                              ]}>
                              {routine.title}
                            </Text>
                            {routine.alarmEnabled && routine.time ? (
                              <View style={styles.badge}>
                                <Icon name="bell" size={12} color={t.textMuted} />
                                <Text style={[styles.badgeText, { color: t.textMuted }]}>
                                  {formatTime(routine.time)}
                                </Text>
                              </View>
                            ) : null}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        visible={menuRoutine !== null}
        animationType="slide"
        onRequestClose={() => setMenuOpenId(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setMenuOpenId(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: t.screen }]}>
            <View style={[styles.sheetHandle, { backgroundColor: t.border }]} />
            <Text style={[Typography.h3, styles.sheetTitle, { color: t.text }]} numberOfLines={1}>
              {menuRoutine?.title}
            </Text>

            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => {
                  const r = menuRoutine;
                  setMenuOpenId(null);
                  if (r) {
                    setRenameText(r.title);
                    setRenameId(r.id);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`${menuRoutine?.title ?? ''} 수정`}
                style={[styles.sheetAction, { backgroundColor: t.surface }]}>
                <Icon name="edit" size={22} color={t.text} />
                <Text style={[Typography.label, { color: t.text }]}>수정하기</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const r = menuRoutine;
                  setMenuOpenId(null);
                  if (r) onDeleteRoutine?.(r.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${menuRoutine?.title ?? ''} 삭제`}
                style={[styles.sheetAction, { backgroundColor: t.surface }]}>
                <Icon name="trash" size={22} color={t.danger} />
                <Text style={[Typography.label, { color: t.danger }]}>삭제하기</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                const r = menuRoutine;
                const cal = menuCalItem;
                setMenuOpenId(null);
                // 서버 백업 날짜에서 연 메뉴는 달력 체크박스와 같은 규칙으로
                // 토글한다 (미래 차단 토스트, 과거 실토글) (#323).
                if (cal) handleCalendarItemPress(cal);
                else if (r) handleToggle(r, menuDate);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${menuRoutine?.title ?? ''} ${menuDone ? '완료 취소' : '완료'}`}
              style={styles.sheetItem}>
              <View style={[styles.sheetItemIcon, { backgroundColor: t.primary }]}>
                <Icon name={menuDone ? 'checkbox-off' : 'check'} size={18} color={t.onPrimary} />
              </View>
              <Text style={[Typography.body, { color: t.text }]}>
                {menuDone ? '완료 취소' : '완료하기'}
              </Text>
            </Pressable>

            {/* 루틴은 알림 시간, 투두는 마감 시각(dueTime) — 같은 항목으로 다룬다 (#325). */}
            <Pressable
              onPress={() => {
                const r = menuRoutine;
                setMenuOpenId(null);
                if (r) setTimeId(r.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${menuRoutine?.title ?? ''} ${menuTimeLabel}`}
              style={styles.sheetItem}>
              <View style={[styles.sheetItemIcon, { backgroundColor: t.warning }]}>
                <Icon name="bell" size={18} color={t.onPrimary} />
              </View>
              <Text style={[Typography.body, { color: t.text }]}>{menuTimeLabel}</Text>
            </Pressable>

            {/* Todos move their dueDate; a routine moves that day's occurrence
                only — the repeat stays (the calendar sheet explains). */}
            <Pressable
              onPress={() => {
                const r = menuRoutine;
                setMenuOpenId(null);
                if (r) {
                  setDateDraft(r.dueDate ?? today);
                  setDateEditId(r.id);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`${menuRoutine?.title ?? ''} 날짜 바꾸기`}
              style={styles.sheetItem}>
              <View style={[styles.sheetItemIcon, { backgroundColor: t.success }]}>
                <Icon name="calendar" size={18} color={t.onPrimary} />
              </View>
              <Text style={[Typography.body, { color: t.text }]}>날짜 바꾸기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 날짜 바꾸기: calendar bottom sheet — the pick stays a draft until 확인. */}
      <Modal
        transparent
        visible={dateEditItem !== null}
        animationType="slide"
        onRequestClose={() => setDateEditId(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setDateEditId(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: t.screen }]}>
            <View style={[styles.sheetHandle, { backgroundColor: t.border }]} />
            <Text style={[Typography.h3, styles.sheetTitle, { color: t.text }]} numberOfLines={1}>
              날짜 바꾸기
            </Text>
            {dateEditItem?.kind !== 'todo' ? (
              <Text style={[Typography.supporting, styles.sheetNote, { color: t.textMuted }]}>
                루틴 반복은 그대로 두고, 선택한 날짜에 이 날 몫이 할 일로 추가돼요.{'\n'}(원래
                날짜에서 숨기는 건 서버 준비 중이에요)
              </Text>
            ) : null}
            <Calendar value={dateDraft} onSelect={setDateDraft} />
            <View style={styles.dialogBtns}>
              <Pressable
                onPress={() => setDateEditId(null)}
                accessibilityRole="button"
                accessibilityLabel="취소"
                style={[styles.dialogBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const r = dateEditItem;
                  setDateEditId(null);
                  if (!r) return;
                  if (r.kind === 'todo') onUpdateTodoDueDate?.(r.id, dateDraft);
                  else onMoveRoutineOccurrence?.(r.id, dateDraft);
                }}
                accessibilityRole="button"
                accessibilityLabel="확인"
                style={[styles.dialogBtn, { backgroundColor: t.primary }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>확인</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={renameId !== null}
        animationType="fade"
        onRequestClose={() => setRenameId(null)}>
        <Pressable style={styles.dialogBackdrop} onPress={() => setRenameId(null)}>
          <Pressable style={[styles.dialogCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>이름 수정</Text>
            <TextInput
              autoFocus
              value={renameText}
              onChangeText={setRenameText}
              placeholder="루틴 이름"
              placeholderTextColor={t.textMuted}
              style={[styles.dialogInput, { color: t.text, backgroundColor: t.surfaceMuted }]}
            />
            <View style={styles.dialogBtns}>
              <Pressable
                onPress={() => setRenameId(null)}
                accessibilityRole="button"
                accessibilityLabel="취소"
                style={[styles.dialogBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const title = renameText.trim();
                  if (renameId && title) onRenameRoutine?.(renameId, title);
                  setRenameId(null);
                }}
                disabled={!renameText.trim()}
                accessibilityRole="button"
                accessibilityLabel="저장"
                style={[
                  styles.dialogBtn,
                  { backgroundColor: renameText.trim() ? t.primary : t.surfaceMuted },
                ]}>
                <Text
                  style={[
                    Typography.label,
                    { color: renameText.trim() ? t.onPrimary : t.textMuted },
                  ]}>
                  저장
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={todoDateOpen}
        animationType="fade"
        onRequestClose={() => setTodoDateOpen(false)}>
        <Pressable style={styles.dialogBackdrop} onPress={() => setTodoDateOpen(false)}>
          <Pressable style={[styles.dialogCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>할 일 날짜</Text>
            <Calendar
              value={newTodoDate}
              onSelect={(date) => {
                setNewTodoDate(date);
                setTodoDateOpen(false);
                // Re-focus the title input so blur-to-commit still works.
                setTimeout(() => todoInputRef.current?.focus(), 60);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header hamburger popover: quick links to the management screens. */}
      <Modal
        transparent
        visible={navMenuOpen}
        animationType="fade"
        onRequestClose={() => setNavMenuOpen(false)}>
        <Pressable style={styles.popoverBackdrop} onPress={() => setNavMenuOpen(false)}>
          <View
            style={[
              styles.popover,
              { top: navMenuTop, backgroundColor: t.screen, borderColor: t.border },
            ]}>
            {(
              [
                ...(onOpenNotifications
                  ? [
                      {
                        icon: 'bell' as const,
                        label: '알림',
                        dot: unreadNotificationCount > 0,
                        onPress: () => onOpenNotifications(),
                      },
                    ]
                  : []),
                ...(ownedCharacters && onSelectCharacter
                  ? [
                      {
                        icon: 'profile' as const,
                        label: '캐릭터 교체',
                        onPress: () => setCharacterSheetOpen(true),
                      },
                    ]
                  : []),
                {
                  icon: 'edit' as const,
                  label: '방 꾸미기',
                  onPress: () => onEdit?.(),
                },
                {
                  icon: 'camera' as const,
                  label: '방 이미지 저장',
                  onPress: () => void onSaveRoomImage(),
                },
                {
                  icon: 'folder' as const,
                  label: '카테고리 관리',
                  onPress: () => setCategorySheetOpen(true),
                },
                {
                  icon: 'list' as const,
                  label: '루틴 관리',
                  // + 버튼(onAddRoutine)은 바로 추가로 가고, 관리는 여기서만 (#335).
                  onPress: () => (onManageRoutines ?? onAddRoutine)?.(),
                },
              ] as { icon: IconName; label: string; dot?: boolean; onPress: () => void }[]
            ).map((item, idx, arr) => (
              <Pressable
                key={item.label}
                onPress={() => {
                  setNavMenuOpen(false);
                  item.onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={[
                  styles.popoverItem,
                  idx !== arr.length - 1 && {
                    borderBottomColor: t.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                ]}>
                <Icon name={item.icon} size={18} color={t.text} />
                <Text style={[Typography.body, { color: t.text }]}>{item.label}</Text>
                {item.dot ? (
                  <View style={[styles.popoverDot, { backgroundColor: t.danger }]} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <CharacterPickerSheet
        visible={characterSheetOpen}
        characters={ownedCharacters ?? []}
        onSelect={(serverId) => onSelectCharacter?.(serverId)}
        onClose={() => setCharacterSheetOpen(false)}
      />

      <CategoryManagerSheet
        visible={categorySheetOpen}
        categories={categories}
        onCreate={(cat) => onCreateCategory?.(cat)}
        onUpdate={(id, cat) => onUpdateCategory?.(id, cat)}
        onDelete={(id) => onDeleteCategory?.(id)}
        onReorder={onReorderCategories}
        inUseCategoryIds={inUseCategoryIds}
        onClose={() => setCategorySheetOpen(false)}
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
    </View>
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  popoverDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  iconGlyph: {
    fontSize: 18,
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
  gachaGlyph: {
    fontSize: 20,
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
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 10,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
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
  catDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  },
  checkbox: {
    justifyContent: 'center',
  },
  rowBody: {
    paddingVertical: Spacing.one,
  },
  // Same width as catDot so checkboxes center under the category emoji and
  // row titles line up with the category label.
  leadIcon: {
    width: 28,
    alignItems: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    marginTop: Spacing.half,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.one,
  },
  sheetTitle: {
    textAlign: 'center',
  },
  sheetNote: {
    textAlign: 'center',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  sheetAction: {
    flex: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sheetItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  dialogInput: {
    fontSize: 16,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  dialogBtns: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dialogBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  todoInput: {
    fontSize: 16,
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
  dateChipText: {
    fontSize: 12,
  },
  center: {
    textAlign: 'center',
  },
  stateBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  emptyHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  retryBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  popover: {
    // `top` comes from the measured hamburger position (navMenuTop).
    position: 'absolute',
    right: Spacing.four,
    minWidth: 176,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
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
    fontSize: 11,
  },
});
