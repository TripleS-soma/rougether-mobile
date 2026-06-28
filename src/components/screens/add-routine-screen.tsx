import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  type NewRoutine,
  ROUTINE_CATEGORIES,
  type RoutineCategory,
  type RoutineCategoryMeta,
} from '@/constants/routines';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { formatDate, formatTime } from '@/utils/datetime';

const SUNDAY = '#E89090';
const DISABLED = '#D4C4B0';
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EMOJI_CHOICES = [
  '☀️',
  '📖',
  '💧',
  '🏃',
  '💖',
  '✨',
  '🌙',
  '☕',
  '🧘',
  '🎵',
  '🍳',
  '💼',
  '🌱',
  '🐱',
  '📝',
  '🎨',
];

type Preset = { emoji: string; title: string; category: RoutineCategory };
const PRESETS: Preset[] = [
  { emoji: '☀️', title: '아침 기상', category: '일정' },
  { emoji: '📖', title: '독서 30분', category: '취미' },
  { emoji: '💧', title: '물 2L 마시기', category: '건강' },
  { emoji: '🏃', title: '운동 인증', category: '건강' },
  { emoji: '💖', title: '감사 일기', category: '취미' },
  { emoji: '✨', title: '영어 공부', category: '공부' },
];

export type AddRoutineScreenProps = {
  onBack?: () => void;
  onAdd?: (routine: NewRoutine) => void;
  categories?: RoutineCategoryMeta[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Add-routine form, ported from the prototype `AddRoutineScreen` (add mode).
 * Title + emoji, category, presets, repeat days, duration / alarm rows, photo
 * verify. The duration/time bottom-sheets, category manager, and edit/delete
 * mode are deferred follow-ups — the rows show current values for now.
 */
export function AddRoutineScreen({
  onBack,
  onAdd,
  categories = ROUTINE_CATEGORIES,
}: AddRoutineScreenProps) {
  const t = useTokens();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('☀️');
  const [showEmoji, setShowEmoji] = useState(false);
  const [category, setCategory] = useState<RoutineCategory>(categories[0]?.id ?? '일정');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [time] = useState('07:00');
  const [startDate] = useState(today());
  const [photoVerify, setPhotoVerify] = useState(false);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const canSubmit = title.trim().length > 0 && days.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onAdd?.({
      title: title.trim(),
      emoji,
      category,
      days,
      startDate,
      alarmEnabled,
      time,
      photoVerify,
    });
    onBack?.();
  };

  return (
    <View style={[styles.screen, { backgroundColor: t.screen }]}>
      <View style={[styles.header, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[styles.backGlyph, { color: t.text }]}>‹</Text>
        </Pressable>
        <Text style={[Typography.h2, { color: t.text }]}>루틴 추가</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Title + emoji */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>루틴 이름</Text>
          <View style={[styles.titleRow, { backgroundColor: t.surface }]}>
            <Pressable
              onPress={() => setShowEmoji((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="이모지 선택"
              style={[
                styles.emojiBtn,
                {
                  backgroundColor: t.surfaceMuted,
                  borderColor: showEmoji ? t.primary : 'transparent',
                },
              ]}>
              <Text style={styles.emojiBig}>{emoji}</Text>
            </Pressable>
            <TextInput
              style={[styles.titleInput, { color: t.text }]}
              value={title}
              onChangeText={setTitle}
              placeholder="예) 매일 30분 산책"
              placeholderTextColor={t.textMuted}
            />
          </View>
          {showEmoji ? (
            <View style={[styles.emojiGrid, { backgroundColor: t.surface }]}>
              {EMOJI_CHOICES.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => {
                    setEmoji(e);
                    setShowEmoji(false);
                  }}
                  style={[
                    styles.emojiCell,
                    { backgroundColor: emoji === e ? t.surfaceMuted : 'transparent' },
                  ]}>
                  <Text style={styles.emojiBig}>{e}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>카테고리</Text>
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

        {/* Presets */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>추천 루틴</Text>
          <View style={styles.presetGrid}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.title}
                onPress={() => {
                  setTitle(p.title);
                  setEmoji(p.emoji);
                  setCategory(p.category);
                }}
                style={[
                  styles.preset,
                  {
                    backgroundColor: t.surface,
                    borderColor: title === p.title ? t.primary : 'transparent',
                  },
                ]}>
                <Text style={styles.presetEmoji}>{p.emoji}</Text>
                <Text style={[Typography.body, styles.flex, { color: t.text }]} numberOfLines={1}>
                  {p.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

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

        {/* Duration (sheet deferred) */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>지속 기간</Text>
          <View style={[styles.infoRow, { backgroundColor: t.surface }]}>
            <View style={[styles.infoIcon, { backgroundColor: t.surfaceMuted }]}>
              <Text style={styles.icon}>📅</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[Typography.body, { color: t.text }]}>
                {formatDate(startDate)} ~ 계속
              </Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                기간 선택 (곧 지원)
              </Text>
            </View>
          </View>
        </View>

        {/* Alarm (sheet deferred, inline toggle) */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>알림 시간</Text>
          <View style={[styles.infoRow, { backgroundColor: t.surface }]}>
            <View style={[styles.infoIcon, { backgroundColor: t.surfaceMuted }]}>
              <Text style={styles.icon}>🔔</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[Typography.body, { color: t.text }]}>
                {alarmEnabled ? formatTime(time) : '알림 없음'}
              </Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                시간 선택 (곧 지원)
              </Text>
            </View>
            <Switch on={alarmEnabled} onToggle={() => setAlarmEnabled((v) => !v)} />
          </View>
        </View>

        {/* Photo verify */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: t.text }]}>인증 방식</Text>
          <View style={[styles.infoRow, { backgroundColor: t.surface }]}>
            <View style={[styles.infoIcon, { backgroundColor: t.surfaceMuted }]}>
              <Text style={styles.icon}>📷</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[Typography.body, { color: t.text }]}>인증사진형</Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                완료할 때 사진을 찍어 인증해요
              </Text>
            </View>
            <Switch on={photoVerify} onToggle={() => setPhotoVerify((v) => !v)} />
          </View>
        </View>
      </ScrollView>

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
          <Text style={[Typography.label, { color: t.onPrimary }]}>루틴 추가하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[styles.switch, { backgroundColor: on ? t.primary : DISABLED }]}>
      <View style={[styles.switchThumb, on && styles.switchThumbOn]} />
    </Pressable>
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
  backGlyph: { fontSize: 26, lineHeight: 28 },
  body: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  field: { gap: Spacing.two },
  label: { fontSize: 14, fontWeight: '600' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    padding: Spacing.two,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBig: { fontSize: 22 },
  titleInput: { flex: 1, fontSize: 16, paddingVertical: Spacing.one },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: Radius.lg,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  emojiCell: {
    width: '11%',
    aspectRatio: 1,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  presetEmoji: { fontSize: 18 },
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
  icon: { fontSize: 16 },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  switchThumbOn: { transform: [{ translateX: 18 }] },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  submit: {
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
});
