import { useState } from 'react';
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
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';
import { formatDate, formatTime } from '@/utils/datetime';

const SUNDAY = '#E89090';
const DISABLED = '#D4C4B0';
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

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
  onDeleteCategory?: (id: string) => void;
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
  onDeleteCategory,
}: AddRoutineScreenProps) {
  const t = useTokens();
  const isEdit = Boolean(editRoutine);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [title, setTitle] = useState(editRoutine?.title ?? '');
  const [category, setCategory] = useState<RoutineCategory>(
    editRoutine?.category ?? categories[0]?.id ?? '일정',
  );
  const [days, setDays] = useState<number[]>(editRoutine?.days ?? [1, 2, 3, 4, 5]);
  const [alarmEnabled, setAlarmEnabled] = useState(editRoutine?.alarmEnabled ?? true);
  const [time, setTime] = useState(editRoutine?.time ?? '07:00');
  const [startDate, setStartDate] = useState(editRoutine?.startDate ?? today());
  const [endDate, setEndDate] = useState<string | undefined>(editRoutine?.endDate);
  const [photoVerify, setPhotoVerify] = useState(editRoutine?.photoVerify ?? false);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [showTimeSheet, setShowTimeSheet] = useState(false);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const canSubmit = title.trim().length > 0 && days.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const payload: NewRoutine = {
      title: title.trim(),
      category,
      days,
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
    <View style={[styles.screen, useScreenStyle()]}>
      <View style={[styles.header, { backgroundColor: t.surface }]}>
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
                  <Text style={[Typography.label, { color: active ? '#FFFFFF' : t.textMuted }]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
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
                    setCategory(p.category);
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

        {/* Repeat days */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>반복 요일</Text>
          <View style={styles.dayRow}>
            {DAYS.map((d, i) => {
              const active = days.includes(i);
              const bg = active ? (i === 0 ? SUNDAY : t.primary) : t.surface;
              return (
                <Pressable
                  key={d}
                  onPress={() => toggleDay(i)}
                  accessibilityRole="button"
                  style={[styles.day, { backgroundColor: bg }]}>
                  <Text style={[Typography.label, { color: active ? '#FFFFFF' : t.textMuted }]}>
                    {d}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
        onDelete={(id) => onDeleteCategory?.(id)}
        onClose={() => setShowCategoryManager(false)}
      />

      <View style={[styles.footer, { backgroundColor: t.screen }]}>
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: canSubmit ? t.primary : DISABLED },
            pressed && canSubmit && { backgroundColor: t.primaryActive },
          ]}>
          <Text style={[Typography.label, { color: t.onPrimary }]}>
            {isEdit ? '수정하기' : '루틴 추가하기'}
          </Text>
        </Pressable>
        {isEdit ? (
          <Pressable
            onPress={() => {
              if (editRoutine) onDelete?.(editRoutine.id);
              onBack?.();
            }}
            accessibilityRole="button"
            accessibilityLabel="루틴 삭제"
            style={[styles.deleteBtn, { borderColor: t.danger }]}>
            <Text style={[Typography.label, { color: t.danger }]}>삭제하기</Text>
          </Pressable>
        ) : null}
      </View>
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
});
