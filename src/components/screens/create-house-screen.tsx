import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type HouseCover, HouseCoverPicker } from '@/components/room/house-cover-picker';
import { HouseCoverArt } from '@/components/room/house-cover-art';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CrownPictogram, Pictogram } from '@/components/ui/pictograms';
import { PrivacyCard } from '@/components/screens/house/privacy-card';
import { Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/components/ui/toast';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';
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
  /** 공개 범위 (#1266) — false면 탐색에 안 뜨고 초대코드로만 참여. */
  isPublic: boolean;
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
  const tr = useT();
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
      <ScreenHeader title={tr('house.create.title')} onBack={onBack} />

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
                name={tr('house.create.selectedThemeA11y')}
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
                {name.trim() || tr('house.create.namePreview')}
              </Text>
            </View>
            <Text style={[Typography.supporting, { color: t.textMuted }]} numberOfLines={1}>
              {description.trim() || tr('house.create.descPreview')}
            </Text>
            <Text style={[styles.meta, emph('normal'), { color: t.textMuted }]}>
              {tr('house.create.previewMeta', {
                n: capacity,
                visibility: isPrivate ? tr('house.create.private') : tr('house.create.public'),
              })}
            </Text>
          </View>
        </View>

        {/* Basic info */}
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <Labeled label={tr('house.create.nameLabel')} t={t}>
            <View style={[styles.inputBox, { backgroundColor: t.surfaceMuted }]}>
              <TextInput
                style={[styles.input, emph('normal'), { color: t.text }]}
                value={name}
                onChangeText={(v) => setName(v.slice(0, 16))}
                placeholder={tr('house.create.namePlaceholder')}
                placeholderTextColor={t.textMuted}
              />
              <Text style={[styles.counter, emph('normal'), { color: t.textDisabled }]}>
                {name.length}/16
              </Text>
            </View>
          </Labeled>
          <Labeled label={tr('house.create.descLabel')} t={t}>
            <View style={[styles.inputBox, { backgroundColor: t.surfaceMuted }]}>
              <TextInput
                style={[styles.input, emph('normal'), { color: t.text }]}
                value={description}
                onChangeText={(v) => setDescription(v.slice(0, 40))}
                placeholder={tr('house.create.descPlaceholder')}
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
              {tr('house.create.theme')}
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
            {tr('house.create.iconColor')}
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
                    {tr(x.labelKey)}
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
              {tr('house.create.capacity')}
            </Text>
            <Text style={[Typography.label, { color: t.primaryText }]}>
              {tr('house.create.capacityValue', { n: capacity })}
            </Text>
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
            {tr('house.create.visibility')}
          </Text>
          <View style={styles.privacyRow}>
            <PrivacyCard
              selected={!isPrivate}
              accent={t.primary}
              title={tr('house.create.public')}
              subtitle={tr('house.create.publicHint')}
              onPress={() => setIsPrivate(false)}
              t={t}
            />
            <PrivacyCard
              selected={isPrivate}
              accent={HOUSE_PRIVATE_ACCENT}
              title={tr('house.create.private')}
              subtitle={tr('house.create.privateHint')}
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
            {tr('house.create.inviteCode')}
          </Text>
          <Text style={[styles.hint, emph('normal'), { color: t.textMuted }]}>
            {tr('house.create.inviteHint')}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            // Blocked tap explains itself instead of a dead gray button.
            if (!canSubmit) return toast(tr('house.create.nameRequired'), 'error');
            onCreate?.({
              name: name.trim(),
              description: description.trim(),
              maxMembers: capacity,
              coverImageKey: coverKey,
              isPublic: !isPrivate,
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
            {tr('house.create.submit')}
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
