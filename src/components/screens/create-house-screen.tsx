import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type HouseCover, HouseCoverPicker } from '@/components/room/house-cover-picker';
import { HouseCoverArt } from '@/components/room/house-cover-art';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CrownPictogram, Pictogram } from '@/components/ui/pictograms';
import { Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import {
  HOUSE_PRIVATE_ACCENT,
  HOUSE_THEME_PRESETS,
  HOUSE_CAPACITY_OPTIONS,
} from '@/constants/house-themes';

export type CreateHouseInput = {
  name: string;
  description?: string;
  maxMembers: number;
  /** Selected cover from GET /houses/cover-images; omitted when none picked. */
  coverImageKey?: string;
};

export type CreateHouseScreenProps = {
  /** Cover catalog (GET /houses/cover-images); empty hides the section. */
  covers?: HouseCover[];
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
export function CreateHouseScreen({ covers = [], onBack, onCreate }: CreateHouseScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [themeId, setThemeId] = useState('morning');
  const [coverKey, setCoverKey] = useState<string | undefined>(undefined);
  const [capacity, setCapacity] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);

  const theme = HOUSE_THEME_PRESETS.find((x) => x.id === themeId) ?? HOUSE_THEME_PRESETS[0];
  const canSubmit = name.trim().length >= 2;
  const { show: toast } = useToast();

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="새 집 만들기" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}>
        {/* Preview */}
        <View style={[styles.card, styles.previewRow, { backgroundColor: t.surface }]}>
          <View
            style={[styles.previewEmoji, { backgroundColor: theme.bg, borderColor: theme.border }]}>
            {coverKey ? (
              <HouseCoverArt
                coverImageKey={coverKey}
                maxMembers={capacity}
                style={styles.previewCover}
                legacyContentFit="cover"
                name="선택한 집 테마"
                testID="preview-cover"
              />
            ) : (
              <Pictogram name={theme.icon} size={30} />
            )}
          </View>
          <View style={styles.flex}>
            <View style={styles.previewNameRow}>
              <CrownPictogram size={13} />
              <Text style={[Typography.label, { color: t.text }]} numberOfLines={1}>
                {name.trim() || '집 이름'}
              </Text>
            </View>
            <Text style={[Typography.supporting, { color: t.textMuted }]} numberOfLines={1}>
              {description.trim() || '한 줄 설명이 여기에 표시돼요'}
            </Text>
            <Text style={[styles.meta, emph('normal'), { color: t.textMuted }]}>
              0 / {capacity}명 · {isPrivate ? '비공개' : '공개'}
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
              <Text style={[styles.counter, emph('normal'), { color: t.textDisabled }]}>
                {name.length}/16
              </Text>
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
              <Text style={[styles.counter, emph('normal'), { color: t.textDisabled }]}>
                {description.length}/40
              </Text>
            </View>
          </Labeled>
        </View>

        {/* Cover image (server catalog) — hidden while the catalog is empty */}
        {covers.length > 0 ? (
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <Text
              style={[
                Typography.supporting,
                emph('semibold'),
                styles.sectionLabel,
                { color: t.textMuted },
              ]}>
              집 테마
            </Text>
            <HouseCoverPicker
              covers={covers}
              selectedKey={coverKey}
              onSelect={setCoverKey}
              maxMembers={capacity}
            />
          </View>
        ) : null}

        {/* Theme */}
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Text
            style={[
              Typography.supporting,
              emph('semibold'),
              styles.sectionLabel,
              { color: t.textMuted },
            ]}>
            아이콘 색상
          </Text>
          <View style={styles.themeGrid}>
            {HOUSE_THEME_PRESETS.map((x) => {
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
                  <Pictogram name={x.icon} size={22} />
                  <Text style={[Typography.supporting, emph('semibold'), { color: t.text }]}>
                    {x.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Capacity */}
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <View style={styles.capacityHead}>
            <Text
              style={[
                Typography.supporting,
                emph('semibold'),
                styles.sectionLabel,
                { color: t.textMuted },
              ]}>
              정원
            </Text>
            <Text style={[Typography.label, { color: t.primaryText }]}>{capacity}명</Text>
          </View>
          <View style={styles.capRow}>
            {HOUSE_CAPACITY_OPTIONS.map((n) => {
              const selected = n === capacity;
              return (
                <Pressable
                  key={n}
                  onPress={() => setCapacity(n)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
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
          <Text
            style={[
              Typography.supporting,
              emph('semibold'),
              styles.sectionLabel,
              { color: t.textMuted },
            ]}>
            공개 설정
          </Text>
          <View style={styles.privacyRow}>
            <PrivacyCard
              selected={!isPrivate}
              accent={t.primary}
              title="공개"
              subtitle="추천 목록에 노출돼요"
              onPress={() => setIsPrivate(false)}
              t={t}
            />
            <PrivacyCard
              selected={isPrivate}
              accent={HOUSE_PRIVATE_ACCENT}
              title="비공개"
              subtitle="초대코드로만 입장 가능"
              onPress={() => setIsPrivate(true)}
              t={t}
            />
          </View>
        </View>

        {/* Invite code: issued by the server on creation */}
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Text
            style={[
              Typography.supporting,
              emph('semibold'),
              styles.sectionLabel,
              { color: t.textMuted },
            ]}>
            초대코드
          </Text>
          <Text style={[styles.hint, emph('normal'), { color: t.textMuted }]}>
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
              coverImageKey: coverKey,
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
  const emph = useFontEmphasis();
  const Typography = useTypography();
  return (
    <View style={styles.labeled}>
      <Text
        style={[
          Typography.supporting,
          emph('semibold'),
          styles.fieldLabel,
          { color: t.textMuted },
        ]}>
        {label}
      </Text>
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
  const Typography = useTypography();
  const emph = useFontEmphasis();
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
      <Text style={[styles.privacySub, emph('normal'), { color: t.textMuted }]}>{subtitle}</Text>
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
    borderRadius: Radius.xl,
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
    overflow: 'hidden',
  },
  previewCover: {
    width: '100%',
    height: '100%',
  },
  previewNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  meta: { fontSize: 13, marginTop: Spacing.half },
  labeled: { gap: Spacing.one },
  fieldLabel: { marginLeft: Spacing.one },
  sectionLabel: { marginLeft: Spacing.one },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.half },
  counter: { fontSize: 12 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  themeCell: {
    width: '31%',
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: Spacing.half,
  },
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
  privacySub: { fontSize: 13 },
  codeRow: { flexDirection: 'row', gap: Spacing.two },
  codeBox: {
    flex: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    justifyContent: 'center',
  },
  codeBtn: {
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 13, marginLeft: Spacing.one },
  submit: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
});
