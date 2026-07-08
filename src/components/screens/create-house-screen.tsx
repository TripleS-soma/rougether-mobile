import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useHeaderInsetStyle, useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

const PRIVATE_ACCENT = '#D4A574';

type Theme = { id: string; label: string; emoji: string; bg: string; border: string };
const THEMES: Theme[] = [
  { id: 'morning', label: '기상', emoji: '🌅', bg: '#FFEFD8', border: '#F0C88A' },
  { id: 'study', label: '공부', emoji: '📚', bg: '#E4DCF0', border: '#B8A8D8' },
  { id: 'code', label: '코딩', emoji: '💻', bg: '#E4F0DC', border: '#A8C898' },
  { id: 'fitness', label: '운동', emoji: '💪', bg: '#FBE0E0', border: '#E8B0A0' },
  { id: 'health', label: '건강', emoji: '💧', bg: '#D8E8F0', border: '#A8C4D8' },
  { id: 'hobby', label: '취미', emoji: '🎨', bg: '#F5E1D8', border: '#E8B8A8' },
];
const CAPACITIES = [2, 3, 4, 6, 8];

export type CreateHouseInput = {
  name: string;
  description?: string;
  maxMembers: number;
};

export type CreateHouseScreenProps = {
  onBack?: () => void;
  /** Create the house via the API — the server issues the real invite code. */
  onCreate?: (input: CreateHouseInput) => void;
};

/**
 * Create-house screen, ported from the prototype `CreateHouseScreen`: live
 * preview + name/description, theme, capacity, privacy, invite code. Theme
 * tokens + type scale; emoji icons. The copy button writes the invite code to
 * the clipboard (expo-clipboard) with brief visual feedback.
 */
export function CreateHouseScreen({ onBack, onCreate }: CreateHouseScreenProps) {
  const t = useTokens();
  const headerInset = useHeaderInsetStyle();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [themeId, setThemeId] = useState('morning');
  const [capacity, setCapacity] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);

  const theme = THEMES.find((x) => x.id === themeId) ?? THEMES[0];
  const canSubmit = name.trim().length >= 2;
  const { show: toast } = useToast();

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <View style={[styles.header, headerInset, { backgroundColor: t.surface }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={[styles.iconBtn, { backgroundColor: t.surfaceMuted }]}>
          <Icon name="back" size={26} color={t.text} />
        </Pressable>
        <Text style={[Typography.h2, { color: t.text }]}>새 집 만들기</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Preview */}
        <View style={[styles.card, styles.previewRow, { backgroundColor: t.surface }]}>
          <View
            style={[styles.previewEmoji, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            <Text style={styles.previewEmojiText}>{theme.emoji}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={[Typography.label, { color: t.text }]} numberOfLines={1}>
              👑 {name.trim() || '집 이름'}
            </Text>
            <Text style={[Typography.supporting, { color: t.textMuted }]} numberOfLines={1}>
              {description.trim() || '한 줄 설명이 여기에 표시돼요'}
            </Text>
            <Text style={[styles.meta, { color: t.textMuted }]}>
              👥 0 / {capacity} · {isPrivate ? '🔒 비공개' : '🌐 공개'}
            </Text>
          </View>
        </View>

        {/* Basic info */}
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Labeled label="집 이름" t={t}>
            <View style={[styles.inputBox, { backgroundColor: t.surfaceMuted }]}>
              <TextInput
                style={[styles.input, { color: t.text }]}
                value={name}
                onChangeText={(v) => setName(v.slice(0, 16))}
                placeholder="우리 집 이름을 정해주세요"
                placeholderTextColor={t.textMuted}
              />
              <Text style={[styles.counter, { color: t.textDisabled }]}>{name.length}/16</Text>
            </View>
          </Labeled>
          <Labeled label="한 줄 설명" t={t}>
            <View style={[styles.inputBox, { backgroundColor: t.surfaceMuted }]}>
              <TextInput
                style={[styles.input, { color: t.text }]}
                value={description}
                onChangeText={(v) => setDescription(v.slice(0, 40))}
                placeholder="어떤 루틴을 함께 할까요?"
                placeholderTextColor={t.textMuted}
              />
              <Text style={[styles.counter, { color: t.textDisabled }]}>
                {description.length}/40
              </Text>
            </View>
          </Labeled>
        </View>

        {/* Theme */}
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Text style={[styles.sectionLabel, { color: t.textMuted }]}>테마 선택</Text>
          <View style={styles.themeGrid}>
            {THEMES.map((x) => {
              const selected = x.id === themeId;
              return (
                <Pressable
                  key={x.id}
                  onPress={() => setThemeId(x.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.themeCell,
                    {
                      backgroundColor: selected ? x.bg : t.surfaceMuted,
                      borderColor: selected ? t.primary : 'transparent',
                    },
                  ]}>
                  <Text style={styles.themeEmoji}>{x.emoji}</Text>
                  <Text style={[styles.themeLabel, { color: t.text }]}>{x.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Capacity */}
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <View style={styles.capacityHead}>
            <Text style={[styles.sectionLabel, { color: t.textMuted }]}>정원</Text>
            <Text style={[Typography.label, { color: t.primary }]}>{capacity}명</Text>
          </View>
          <View style={styles.capRow}>
            {CAPACITIES.map((n) => {
              const selected = n === capacity;
              return (
                <Pressable
                  key={n}
                  onPress={() => setCapacity(n)}
                  accessibilityRole="button"
                  style={[
                    styles.capBtn,
                    { backgroundColor: selected ? t.primary : t.surfaceMuted },
                  ]}>
                  <Text style={[Typography.label, { color: selected ? t.onPrimary : t.textMuted }]}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Privacy */}
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Text style={[styles.sectionLabel, { color: t.textMuted }]}>공개 설정</Text>
          <View style={styles.privacyRow}>
            <PrivacyCard
              selected={!isPrivate}
              accent={t.primary}
              title="🌐 공개"
              subtitle="추천 목록에 노출돼요"
              onPress={() => setIsPrivate(false)}
              t={t}
            />
            <PrivacyCard
              selected={isPrivate}
              accent={PRIVATE_ACCENT}
              title="🔒 비공개"
              subtitle="초대코드로만 입장 가능"
              onPress={() => setIsPrivate(true)}
              t={t}
            />
          </View>
        </View>

        {/* Invite code: issued by the server on creation */}
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Text style={[styles.sectionLabel, { color: t.textMuted }]}>초대코드</Text>
          <Text style={[styles.hint, { color: t.textMuted }]}>
            집을 만들면 초대코드가 자동으로 발급돼요. 집 화면의 구성원 관리에서 확인하고 친구에게
            공유할 수 있어요.
          </Text>
        </View>

        <Pressable
          onPress={() => {
            // Blocked tap explains itself instead of a dead gray button.
            if (!canSubmit) return toast('집 이름을 2자 이상 입력해주세요', 'error');
            onCreate?.({
              name: name.trim(),
              description: description.trim(),
              maxMembers: capacity,
            });
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: canSubmit ? t.primary : t.disabledBg },
            pressed && canSubmit && { backgroundColor: t.primaryActive },
          ]}>
          <Text style={[Typography.label, { color: canSubmit ? t.onPrimary : t.textMuted }]}>
            집 만들기
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Labeled({
  label,
  t,
  children,
}: {
  label: string;
  t: ReturnType<typeof useTokens>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.labeled}>
      <Text style={[styles.fieldLabel, { color: t.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

function PrivacyCard({
  selected,
  accent,
  title,
  subtitle,
  onPress,
  t,
}: {
  selected: boolean;
  accent: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  t: ReturnType<typeof useTokens>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.privacyCard,
        { backgroundColor: t.surfaceMuted, borderColor: selected ? accent : 'transparent' },
      ]}>
      <Text style={[Typography.label, { color: t.text }]}>{title}</Text>
      <Text style={[styles.privacySub, { color: t.textMuted }]}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  body: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  card: { borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.three },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  previewEmoji: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmojiText: { fontSize: 30 },
  meta: { fontSize: 11, marginTop: 2 },
  labeled: { gap: Spacing.one },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginLeft: Spacing.one },
  sectionLabel: { fontSize: 12, fontWeight: '600', marginLeft: Spacing.one },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: Spacing.half },
  counter: { fontSize: 10 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  themeCell: {
    width: '31%',
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: Spacing.half,
  },
  themeEmoji: { fontSize: 22 },
  themeLabel: { fontSize: 12, fontWeight: '600' },
  capacityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capRow: { flexDirection: 'row', gap: Spacing.two },
  capBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  privacyRow: { flexDirection: 'row', gap: Spacing.two },
  privacyCard: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 2,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  privacySub: { fontSize: 11 },
  codeRow: { flexDirection: 'row', gap: Spacing.two },
  codeBox: {
    flex: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    justifyContent: 'center',
  },
  codeText: { fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  codeBtn: {
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBtnText: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 11, marginLeft: Spacing.one },
  submit: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
});
