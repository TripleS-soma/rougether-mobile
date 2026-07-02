import { useRef, useState } from 'react';
import {
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

import { CharacterAvatar } from '@/components/character-avatar';
import { Room } from '@/components/room/room';
import { TimePickerSheet } from '@/components/screens/sheets/time-picker-sheet';
import { Calendar } from '@/components/ui/calendar';
import { CHARACTER_OPTIONS, type CharacterId, DEFAULT_CHARACTER_ID } from '@/constants/characters';
import { ROUTINE_CATEGORIES, type Routine, type RoutineCategoryMeta } from '@/constants/routines';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { captureVerificationPhoto } from '@/lib/photo-verify';
import { DEFAULT_WALLPAPER_ID } from '@/resources/furniture';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import { formatDate, formatTime, todayIso } from '@/utils/datetime';
import { hapticSelection, hapticSuccess } from '@/utils/haptics';

export type MyRoomScreenProps = {
  /** Room occupant's display name (header title becomes "{userName}의 방"). */
  userName?: string;
  /** Consecutive-day streak shown in the header. */
  streakDays?: number;
  // Room rendering (forwarded to <Room />).
  characterId?: CharacterId;
  wallpaperId?: string;
  placedFurnitureIds?: string[];
  // Routine list.
  routines?: Routine[];
  /**
   * Per-routine completion log: routine id → completed dates ("YYYY-MM-DD").
   * Mirrors the spec's routine_logs; a routine is "done" on a date when that
   * date is present here.
   */
  completions?: Record<string, string[]>;
  categories?: RoutineCategoryMeta[];
  // Callbacks (wired separately).
  onEdit?: () => void;
  onAddRoutine?: () => void;
  /** Toggle a routine's completion on a specific date ("YYYY-MM-DD"). */
  onToggleCompletion?: (id: string, date: string) => void;
  onOpenGacha?: () => void;
  /** Quick-add a todo to a category with a due date (the + on a category header). */
  onQuickAddRoutine?: (category: string, title: string, dueDate: string) => void;
  /** Rename a routine (kebab → 수정: name only; full edit lives in 루틴 관리). */
  onRenameRoutine?: (id: string, title: string) => void;
  /** Update a routine's alarm time (kebab → 시간 수정, reuses TimePickerSheet). */
  onUpdateRoutineTime?: (id: string, alarmEnabled: boolean, time: string) => void;
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
export function MyRoomScreen({
  userName = '준서',
  streakDays = 7,
  characterId = DEFAULT_CHARACTER_ID,
  wallpaperId = DEFAULT_WALLPAPER_ID,
  placedFurnitureIds,
  routines = [],
  completions = {},
  categories = ROUTINE_CATEGORIES,
  onEdit,
  onAddRoutine,
  onToggleCompletion,
  onOpenGacha,
  onQuickAddRoutine,
  onRenameRoutine,
  onUpdateRoutineTime,
  onDeleteRoutine,
  onRequestPhoto = captureVerificationPhoto,
}: MyRoomScreenProps) {
  const t = useTokens();
  const character = CHARACTER_OPTIONS.find((c) => c.id === characterId) ?? CHARACTER_OPTIONS[0];
  const knownIds = categories.map((c) => c.id);

  const today = todayIso();
  const isDone = (id: string, date: string) => (completions[id] ?? []).includes(date);

  // The 방 tab shows today: recurring routines always, todos only if due today.
  const roomRoutines = routines.filter((r) => r.kind !== 'todo' || r.dueDate === today);
  const completedCount = roomRoutines.filter((r) => isDone(r.id, today)).length;
  const progress = roomRoutines.length > 0 ? completedCount / roomRoutines.length : 0;

  // Which category's quick-add input is open, the in-progress todo text + due
  // date, and which routine's kebab menu is open.
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newTodo, setNewTodo] = useState('');
  const [newTodoDate, setNewTodoDate] = useState(today);
  const [todoDateOpen, setTodoDateOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRoutine = routines.find((r) => r.id === menuOpenId) ?? null;
  const menuDone = menuRoutine ? isDone(menuRoutine.id, today) : false;

  // Kebab → 수정: rename only (id + draft text). Kebab → 시간 수정: TimePickerSheet.
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [timeId, setTimeId] = useState<string | null>(null);
  const timeRoutine = routines.find((r) => r.id === timeId) ?? null;

  // 방 / 달력 tab. The calendar lists routines + todos on the selected date.
  const [tab, setTab] = useState<'room' | 'calendar'>('room');
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const selectedWeekday = (() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  })();
  const dateRoutines = routines.filter((r) => {
    if (r.kind === 'todo') return r.dueDate === selectedDate;
    if (r.startDate && selectedDate < r.startDate) return false;
    if (r.endDate && selectedDate > r.endDate) return false;
    if (r.days && r.days.length) return r.days.includes(selectedWeekday);
    return true;
  });

  // Scroll the tapped category's quick-add input into view (above the keyboard).
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef(0);
  const groupY = useRef<Record<string, number>>({});
  const todoInputRef = useRef<TextInput>(null);
  // Set while opening the date picker so the input's blur doesn't commit/close.
  const skipBlurCommit = useRef(false);

  const openQuickAdd = (categoryId: string) => {
    setNewTodo('');
    setNewTodoDate(today);
    const opening = addingCategory !== categoryId;
    setAddingCategory(opening ? categoryId : null);
    if (opening) {
      // Let the input render, then scroll the category near the top.
      setTimeout(() => {
        const y = sectionY.current + (groupY.current[categoryId] ?? 0);
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }, 80);
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

  return (
    <View style={[styles.screen, useScreenStyle()]}>
      <View style={[styles.header, { backgroundColor: t.surface }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatar, { backgroundColor: character.bg }]}>
            <CharacterAvatar characterId={characterId} size={36} />
          </View>
          <View>
            <Text style={[Typography.h3, { color: t.text }]}>{userName}의 방</Text>
            <View style={styles.streak}>
              <Icon name="flame" size={14} color={t.warning} />
              <Text style={[Typography.supporting, { color: t.warning }]}>{streakDays}일</Text>
            </View>
          </View>
        </View>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="방 편집"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="edit" size={18} color={t.text} />
        </Pressable>
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
              <Text style={[Typography.label, { color: active ? t.primary : t.textMuted }]}>
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
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled">
          {tab === 'room' ? (
            <>
              <View style={styles.roomWrap}>
                <Room
                  characterId={characterId}
                  wallpaperId={wallpaperId}
                  placedFurnitureIds={placedFurnitureIds}
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

              <View
                style={styles.section}
                onLayout={(e) => {
                  sectionY.current = e.nativeEvent.layout.y;
                }}>
                <View style={styles.sectionHead}>
                  <Text style={[Typography.h2, { color: t.text }]}>오늘의 루틴</Text>
                  <View style={styles.sectionHeadRight}>
                    <Text style={[Typography.label, { color: t.primary }]}>
                      {completedCount} / {roomRoutines.length}
                    </Text>
                    <Pressable
                      onPress={onAddRoutine}
                      accessibilityRole="button"
                      accessibilityLabel="루틴 추가"
                      style={[styles.addBtn, { backgroundColor: t.primary }]}>
                      <Icon name="add" size={18} color={t.onPrimary} />
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.progressTrack, { backgroundColor: t.surfaceMuted }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: t.primary, width: `${progress * 100}%` },
                    ]}
                  />
                </View>

                {categories.map((cat, idx) => {
                  const isFallback = idx === categories.length - 1;
                  const items = roomRoutines.filter((r) => {
                    if (r.category === cat.id) return true;
                    return isFallback && (!r.category || !knownIds.includes(r.category));
                  });
                  if (items.length === 0) return null;
                  const doneInCat = items.filter((r) => isDone(r.id, today)).length;

                  return (
                    <View
                      key={cat.id}
                      style={styles.group}
                      onLayout={(e) => {
                        groupY.current[cat.id] = e.nativeEvent.layout.y;
                      }}>
                      <View style={styles.catHeader}>
                        <View style={[styles.catDot, { backgroundColor: `${cat.color}33` }]}>
                          <Text style={styles.catEmoji}>{cat.emoji}</Text>
                        </View>
                        <Text style={[Typography.label, { color: cat.color }]}>{cat.label}</Text>
                        <Text style={[Typography.supporting, { color: t.textDisabled }]}>
                          {doneInCat}/{items.length}
                        </Text>
                        <View style={styles.flex} />
                        <Pressable
                          onPress={() => openQuickAdd(cat.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`${cat.label} 할 일 추가`}
                          style={[styles.catAdd, { backgroundColor: cat.color }]}>
                          <Icon name="add" size={14} color={t.onPrimary} />
                        </Pressable>
                      </View>

                      <View style={styles.rows}>
                        {items.map((routine) => {
                          const menuOpen = menuOpenId === routine.id;
                          const done = isDone(routine.id, today);
                          return (
                            <View key={routine.id}>
                              <View style={styles.routineRow}>
                                <Pressable
                                  onPress={() => handleToggle(routine, today)}
                                  accessibilityRole="checkbox"
                                  accessibilityState={{ checked: done }}
                                  accessibilityLabel={routine.title}
                                  style={styles.rowMain}>
                                  <Icon
                                    name={done ? 'checkbox-on' : 'checkbox-off'}
                                    size={22}
                                    color={done ? cat.color : t.textDisabled}
                                  />
                                  <View style={styles.flex}>
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
                                  </View>
                                </Pressable>
                                <Pressable
                                  onPress={() => setMenuOpenId(menuOpen ? null : routine.id)}
                                  accessibilityRole="button"
                                  accessibilityLabel={`${routine.title} 메뉴`}
                                  style={styles.kebab}>
                                  <Icon name="kebab" size={20} color={t.textDisabled} />
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}

                        {addingCategory === cat.id ? (
                          <View style={[styles.addRow, { backgroundColor: t.surface }]}>
                            <Icon name="checkbox-off" size={22} color={t.textDisabled} />
                            <TextInput
                              ref={todoInputRef}
                              autoFocus
                              value={newTodo}
                              onChangeText={setNewTodo}
                              // Commit on blur — pressing 완료 (single-line blurs on
                              // submit) or tapping elsewhere both save the todo.
                              onBlur={() => commitTodo(cat.id)}
                              placeholder="할 일 입력 후 완료"
                              placeholderTextColor={t.textMuted}
                              style={[styles.flex, styles.todoInput, { color: t.text }]}
                            />
                            <Pressable
                              // onPressIn (fires before the input's blur) flags the
                              // blur as picker-driven so the row stays open.
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
                        ) : null}
                      </View>
                    </View>
                  );
                })}

                <Pressable
                  onPress={onEdit}
                  accessibilityRole="button"
                  accessibilityLabel="방 편집하기"
                  style={[styles.editBtn, { backgroundColor: t.surface, borderColor: t.border }]}>
                  <Icon name="edit" size={16} color={t.text} />
                  <Text style={[Typography.label, { color: t.text }]}>방 편집</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.calendarPanel}>
              <Calendar value={selectedDate} onSelect={setSelectedDate} />
              <Text style={[Typography.h3, styles.calListTitle, { color: t.text }]}>
                이 날의 루틴
              </Text>
              {dateRoutines.length === 0 ? (
                <Text style={[Typography.body, styles.calEmpty, { color: t.textMuted }]}>
                  예정된 루틴이 없어요.
                </Text>
              ) : (
                dateRoutines.map((routine) => {
                  const catColor =
                    categories.find((c) => c.id === routine.category)?.color ?? t.primary;
                  const done = isDone(routine.id, selectedDate);
                  return (
                    <Pressable
                      key={routine.id}
                      onPress={() => handleToggle(routine, selectedDate)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done }}
                      accessibilityLabel={routine.title}
                      style={styles.routineRow}>
                      <View style={styles.rowMain}>
                        <Icon
                          name={done ? 'checkbox-on' : 'checkbox-off'}
                          size={22}
                          color={done ? catColor : t.textDisabled}
                        />
                        <View style={styles.flex}>
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
                        </View>
                      </View>
                    </Pressable>
                  );
                })
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
                setMenuOpenId(null);
                if (r) handleToggle(r, today);
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

            <Pressable
              onPress={() => {
                const r = menuRoutine;
                setMenuOpenId(null);
                if (r) setTimeId(r.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${menuRoutine?.title ?? ''} 시간 수정`}
              style={styles.sheetItem}>
              <View style={[styles.sheetItemIcon, { backgroundColor: t.warning }]}>
                <Icon name="bell" size={18} color={t.onPrimary} />
              </View>
              <Text style={[Typography.body, { color: t.text }]}>시간 수정</Text>
            </Pressable>
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
  calEmpty: {
    paddingVertical: Spacing.three,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
    paddingHorizontal: Spacing.half,
  },
  catDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catEmoji: {
    fontSize: 14,
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
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
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
  kebab: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
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
  editBtn: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
