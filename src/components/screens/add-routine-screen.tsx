import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CategoryManagerSheet } from '@/components/screens/sheets/category-manager-sheet';
import { DateRangeSheet } from '@/components/screens/sheets/date-range-sheet';
import { TimePickerSheet } from '@/components/screens/sheets/time-picker-sheet';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import {
  type NewRoutine,
  type Routine,
  ROUTINE_CATEGORIES,
  type RoutineCategory,
  type RoutineCategoryMeta,
} from '@/constants/routines';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import { formatDate, formatTime } from '@/utils/datetime';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

type RepeatType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
// The server currently validates repeatType against DAILY|WEEKLY only — the
// rest render disabled until the API supports them.
const REPEAT_OPTIONS: { id: RepeatType; label: string; supported: boolean }[] = [
  { id: 'daily', label: '매일', supported: true },
  { id: 'weekly', label: '매주', supported: true },
  { id: 'biweekly', label: '격주', supported: false },
  { id: 'monthly', label: '매월', supported: false },
  { id: 'yearly', label: '매년', supported: false },
];

type Preset = { title: string; category: RoutineCategory };
const PRESETS: Preset[] = [
  { title: '아침 기상', category: '일정' },
  { title: '독서 30분', category: '취미' },
  { title: '물 2L 마시기', category: '건강' },
  { title: '운동 인증', category: '건강' },
  { title: '감사 일기', category: '취미' },
  { title: '영어 공부', category: '공부' },
];

export type AddRoutineScreenProps = {
  onBack?: () => void;
  onAdd?: (routine: NewRoutine) => void;
  /** Edit-mode: the routine being edited; prefills the form and switches the
   *  screen to "루틴 수정". */
  editRoutine?: Routine | null;
  onUpdate?: (id: string, routine: NewRoutine) => void;
  onDelete?: (id: string) => void;
  categories?: RoutineCategoryMeta[];
  onCreateCategory?: (category: RoutineCategoryMeta) => void;
  onUpdateCategory?: (id: string, category: RoutineCategoryMeta) => void;
  onDeleteCategory?: (id: string) => void;
  /** Persist a new category order (카테고리 관리 sheet, long-press to move). */
  onReorderCategories?: (orderedIds: string[]) => void;
  /** Categories with routines — deletion is blocked with a warning modal. */
  inUseCategoryIds?: string[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Add/edit-routine form, ported from the prototype `AddRoutineScreen`. Title +
 * emoji, category, presets, repeat days, duration / alarm sheets, photo verify.
 * When `editRoutine` is given, the form prefills its values and submitting calls
 * `onUpdate` (with a delete action); otherwise it's add mode with `onAdd`.
 */
export function AddRoutineScreen({
  onBack,
  onAdd,
  editRoutine,
  onUpdate,
  onDelete,
  categories = ROUTINE_CATEGORIES,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  inUseCategoryIds,
}: AddRoutineScreenProps) {
  const t = useTokens();
  const headerInset = useHeaderInsetStyle();
  const isEdit = Boolean(editRoutine);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [title, setTitle] = useState(editRoutine?.title ?? '');
  const [category, setCategory] = useState<RoutineCategory>(
    editRoutine?.category ?? categories[0]?.id ?? '',
  );
  // Every routine must belong to an existing category — no uncategorized
  // routines. Categories load async, so re-seed once they arrive.
  const categoryValid = categories.some((c) => c.id === category);
  useEffect(() => {
    if (!categoryValid && categories.length > 0) setCategory(categories[0].id);
  }, [categoryValid, categories]);
  // Repeat cadence: a routine with repeat days is weekly, without is daily.
  const [repeat, setRepeat] = useState<RepeatType>(
    editRoutine && !editRoutine.days?.length ? 'daily' : 'weekly',
  );
  const [days, setDays] = useState<number[]>(editRoutine?.days ?? [1, 2, 3, 4, 5]);
  const [alarmEnabled, setAlarmEnabled] = useState(editRoutine?.alarmEnabled ?? true);
  const [time, setTime] = useState(editRoutine?.time ?? '07:00');
  const [startDate, setStartDate] = useState(editRoutine?.startDate ?? today());
  const [endDate, setEndDate] = useState<string | undefined>(editRoutine?.endDate);
  const [photoVerify, setPhotoVerify] = useState(editRoutine?.photoVerify ?? false);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [showTimeSheet, setShowTimeSheet] = useState(false);
  // 삭제하기 tapped — deletion only proceeds through the confirm modal.
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const canSubmit =
    title.trim().length > 0 && (repeat !== 'weekly' || days.length > 0) && categoryValid;
  // Why the submit is blocked — set when the user taps it anyway. Without this
  // a fresh account (0 categories) just saw a dead gray button.
  const [formError, setFormError] = useState('');
  useEffect(() => {
    if (canSubmit) setFormError('');
  }, [canSubmit]);

  const submit = () => {
    if (!canSubmit) {
      if (!categoryValid) {
        setFormError('카테고리가 필요해요 — 먼저 하나 만들어주세요.');
        setShowCategoryManager(true);
      } else if (title.trim().length === 0) {
        setFormError('루틴 이름을 입력해주세요.');
      } else {
        setFormError('반복 요일을 하나 이상 선택해주세요.');
      }
      return;
    }
    const payload: NewRoutine = {
      title: title.trim(),
      category,
      // Empty days = daily (the adapter maps it to repeatType DAILY).
      days: repeat === 'weekly' ? days : [],
      startDate,
      endDate,
      alarmEnabled,
      time,
      photoVerify,
    };
    if (editRoutine) onUpdate?.(editRoutine.id, payload);
    else onAdd?.(payload);
    onBack?.();
  };

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="back" size={26} color={t.text} />
        </Pressable>
        <Text style={[Typography.h2, { color: t.text }]}>{isEdit ? '루틴 수정' : '루틴 추가'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Title */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>루틴 이름</Text>
          <View style={[styles.titleRow, { backgroundColor: t.surface }]}>
            <TextInput
              style={[styles.titleInput, { color: t.text }]}
              value={title}
              onChangeText={setTitle}
              placeholder="예) 매일 30분 산책"
              placeholderTextColor={t.textMuted}
            />
          </View>
        </View>

        {/* Category */}
        <View style={styles.field}>
          <View style={styles.fieldHead}>
            <Text style={[styles.label, { color: t.text }]}>카테고리</Text>
            <Pressable
              onPress={() => setShowCategoryManager(true)}
              accessibilityRole="button"
              accessibilityLabel="카테고리 관리"
              hitSlop={8}
              style={styles.manageBtn}>
              <Icon name="add" size={16} color={t.primary} />
              <Text style={[Typography.label, { color: t.primary }]}>관리</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            {categories.map((c) => {
              const active = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[styles.chip, { backgroundColor: active ? c.color : t.surface }]}>
                  <Text style={styles.chipEmoji}>{c.emoji}</Text>
                  <Text style={[Typography.label, { color: active ? t.onPrimary : t.textMuted }]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {categories.length === 0 ? (
            <Text style={[Typography.supporting, { color: t.textMuted }]}>
              카테고리가 없어요. 위의 관리 버튼으로 먼저 만들어주세요.
            </Text>
          ) : null}
        </View>

        {/* Presets (add mode only) */}
        {!isEdit ? (
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.text }]}>추천 루틴</Text>
            <View style={styles.presetGrid}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.title}
                  onPress={() => {
                    setTitle(p.title);
                    // Presets name local category labels; only switch when the
                    // user actually has a matching category.
                    const match = categories.find(
                      (c) => c.id === p.category || c.label === p.category,
                    );
                    if (match) setCategory(match.id);
                  }}
                  style={[
                    styles.preset,
                    {
                      backgroundColor: t.surface,
                      borderColor: title === p.title ? t.primary : 'transparent',
                    },
                  ]}>
                  <Text style={[Typography.body, styles.flex, { color: t.text }]} numberOfLines={1}>
                    {p.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Repeat cadence + days */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>반복</Text>
          <View style={styles.repeatRow}>
            {REPEAT_OPTIONS.map((opt) => {
              const active = repeat === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => opt.supported && setRepeat(opt.id)}
                  disabled={!opt.supported}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: active, disabled: !opt.supported }}
                  style={[
                    styles.repeatChip,
                    { backgroundColor: active ? t.primary : t.surface },
                    !opt.supported && styles.repeatChipDisabled,
                  ]}>
                  <Text
                    style={[
                      Typography.label,
                      {
                        color: active ? t.onPrimary : opt.supported ? t.textMuted : t.textDisabled,
                      },
                    ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            격주·매월·매년은 서버 준비 중이에요.
          </Text>
          {repeat === 'weekly' ? (
            <>
              <Text style={[styles.label, styles.dayLabel, { color: t.text }]}>반복 요일</Text>
              <View style={styles.dayRow}>
                {DAYS.map((d, i) => {
                  const active = days.includes(i);
                  const bg = active ? (i === 0 ? t.danger : t.primary) : t.surface;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => toggleDay(i)}
                      accessibilityRole="button"
                      style={[styles.day, { backgroundColor: bg }]}>
                      <Text
                        style={[Typography.label, { color: active ? t.onPrimary : t.textMuted }]}>
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>

        {/* Duration */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>지속 기간</Text>
          <Pressable
            onPress={() => setShowDateSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="지속 기간 선택"
            style={[styles.infoRow, { backgroundColor: t.surface }]}>
            <View style={[styles.infoIcon, { backgroundColor: t.surfaceMuted }]}>
              <Icon name="calendar" size={16} color={t.icon} />
            </View>
            <View style={styles.flex}>
              <Text style={[Typography.body, { color: t.text }]}>
                {formatDate(startDate)} ~ {endDate ? formatDate(endDate) : '계속'}
              </Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>기간 선택</Text>
            </View>
            <Text style={[styles.chevron, { color: t.textDisabled }]}>›</Text>
          </Pressable>
        </View>

        {/* Alarm */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>알림 시간</Text>
          <Pressable
            onPress={() => setShowTimeSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="알림 시간 선택"
            style={[styles.infoRow, { backgroundColor: t.surface }]}>
            <View style={[styles.infoIcon, { backgroundColor: t.surfaceMuted }]}>
              <Icon name="bell" size={16} color={t.icon} />
            </View>
            <View style={styles.flex}>
              <Text style={[Typography.body, { color: t.text }]}>
                {alarmEnabled ? formatTime(time) : '알림 없음'}
              </Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>시간 선택</Text>
            </View>
            <Text style={[styles.chevron, { color: t.textDisabled }]}>›</Text>
          </Pressable>
        </View>

        {/* Photo verify */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>인증 방식</Text>
          <View style={[styles.infoRow, { backgroundColor: t.surface }]}>
            <View style={[styles.infoIcon, { backgroundColor: t.surfaceMuted }]}>
              <Icon name="camera" size={16} color={t.icon} />
            </View>
            <View style={styles.flex}>
              <Text style={[Typography.body, { color: t.text }]}>인증사진형</Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                완료할 때 사진을 찍어 인증해요
              </Text>
            </View>
            <ToggleSwitch
              value={photoVerify}
              onToggle={() => setPhotoVerify((v) => !v)}
              accessibilityLabel="인증사진형"
            />
          </View>
        </View>
      </ScrollView>

      <DateRangeSheet
        visible={showDateSheet}
        initialStartDate={startDate}
        initialEndDate={endDate}
        onSave={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
        onClose={() => setShowDateSheet(false)}
      />
      <TimePickerSheet
        visible={showTimeSheet}
        initialEnabled={alarmEnabled}
        initialTime={time}
        onSave={(enabled, value) => {
          setAlarmEnabled(enabled);
          setTime(value);
        }}
        onClose={() => setShowTimeSheet(false)}
      />
      <CategoryManagerSheet
        visible={showCategoryManager}
        categories={categories}
        onCreate={(c) => onCreateCategory?.(c)}
        onUpdate={(id, c) => onUpdateCategory?.(id, c)}
        onDelete={(id) => onDeleteCategory?.(id)}
        onReorder={onReorderCategories}
        inUseCategoryIds={inUseCategoryIds}
        onClose={() => setShowCategoryManager(false)}
      />

      <View style={[styles.footer, { backgroundColor: t.screen }]}>
        {formError ? (
          <Text style={[Typography.supporting, styles.footerError, { color: t.danger }]}>
            {formError}
          </Text>
        ) : null}
        {/* Pressable even when invalid — the tap explains what's missing
            (and opens the category manager when that's the blocker). */}
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: canSubmit ? t.primary : t.disabledBg },
            pressed && canSubmit && { backgroundColor: t.primaryActive },
          ]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>
            {isEdit ? '수정하기' : '루틴 추가하기'}
          </Text>
        </Pressable>
        {isEdit ? (
          <Pressable
            onPress={() => setConfirmDelete(true)}
            accessibilityRole="button"
            accessibilityLabel="루틴 삭제"
            style={[styles.deleteBtn, { borderColor: t.danger }]}>
            <Text style={[Typography.label, { color: t.danger }]}>삭제하기</Text>
          </Pressable>
        ) : null}
      </View>

      {confirmDelete && editRoutine ? (
        <View style={styles.confirmOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setConfirmDelete(false)} />
          <View style={[styles.confirmCard, { backgroundColor: t.screen }]}>
            <Text style={[Typography.h3, { color: t.text }]}>루틴 삭제</Text>
            <Text style={[Typography.body, styles.confirmText, { color: t.textMuted }]}>
              &lsquo;{editRoutine.title}&rsquo; 루틴을 삭제할까요?{'\n'}삭제하면 지난 수행 기록도
              함께 사라져요.
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable
                onPress={() => setConfirmDelete(false)}
                accessibilityRole="button"
                accessibilityLabel="취소"
                style={[styles.confirmBtn, { backgroundColor: t.surfaceMuted }]}>
                <Text style={[Typography.label, { color: t.text }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmDelete(false);
                  onDelete?.(editRoutine.id);
                  onBack?.();
                }}
                accessibilityRole="button"
                accessibilityLabel="삭제"
                style={[styles.confirmBtn, { backgroundColor: t.danger }]}>
                <Text style={[Typography.label, { color: t.onPrimary }]}>삭제</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  field: { gap: Spacing.two },
  fieldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  label: { fontSize: 14, fontWeight: '600' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    padding: Spacing.two,
  },
  titleInput: { flex: 1, fontSize: 16, paddingVertical: Spacing.one },
  chips: { gap: Spacing.two, paddingVertical: Spacing.half },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  chipEmoji: { fontSize: 14 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  preset: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  repeatRow: { flexDirection: 'row', gap: Spacing.one },
  repeatChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  repeatChipDisabled: { opacity: 0.5 },
  dayLabel: { marginTop: Spacing.two },
  dayRow: { flexDirection: 'row', gap: Spacing.one },
  day: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: { fontSize: 20 },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  footerError: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  submit: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  deleteBtn: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    elevation: 200,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  confirmCard: {
    width: '80%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  confirmText: {
    lineHeight: 22,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});
