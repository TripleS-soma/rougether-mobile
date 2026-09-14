import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DEFAULT_HAPTIC_STRENGTH, type HapticStrength } from '@/utils/haptics';
import { PendingNotice } from '@/components/ui/pending-notice';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export type SoundSettings = {
  effects: boolean;
  music: boolean;
  /** 햅틱 세기 (#974). 종전 boolean은 셸이 마이그레이션한다. */
  hapticStrength: HapticStrength;
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  effects: true,
  music: false,
  hapticStrength: DEFAULT_HAPTIC_STRENGTH,
};

type ToggleKey = 'effects' | 'music';

/** 행 문구는 `member.soundSettings.rows.<key>` (#893). */
const ROW_KEYS: ToggleKey[] = ['effects', 'music'];

/** 햅틱 세기 (#974) — 켜고 끄는 것만으로는 '너무 세다'를 해결할 수 없었다. */
const STRENGTH_IDS: HapticStrength[] = ['off', 'light', 'medium', 'heavy'];

export type SoundSettingsScreenProps = {
  initialSettings?: SoundSettings;
  onChange?: (settings: SoundSettings) => void;
  onBack?: () => void;
};

/**
 * "효과음" settings reached from 설정 → 효과음. Toggles for sound effects,
 * background music, and haptics. Pure/prop-driven; the app shell persists via
 * onChange.
 */
export function SoundSettingsScreen({
  initialSettings = DEFAULT_SOUND_SETTINGS,
  onChange,
  onBack,
}: SoundSettingsScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const Typography = useTypography();
  const tr = useT();
  const [settings, setSettings] = useState(initialSettings);
  const rows = ROW_KEYS.map((key) => ({
    key,
    label: tr(`member.soundSettings.rows.${key}.label`),
    desc: tr(`member.soundSettings.rows.${key}.desc`),
  }));
  const strengths = STRENGTH_IDS.map((id) => ({
    id,
    label: tr(`member.soundSettings.strength.${id}`),
  }));

  const apply = (next: SoundSettings) => {
    setSettings(next);
    onChange?.(next);
  };
  const toggle = (key: ToggleKey) => apply({ ...settings, [key]: !settings[key] });

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title={tr('member.soundSettings.title')} onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}>
        <PendingNotice text={tr('member.soundSettings.pending')} />
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          {rows.map((r, idx) => (
            <View
              key={r.key}
              style={[
                styles.row,
                idx !== rows.length - 1 && {
                  borderBottomColor: t.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}>
              <View style={styles.flex}>
                <Text style={[Typography.body, { color: t.text }]}>{r.label}</Text>
                <Text style={[Typography.supporting, { color: t.textMuted }]}>{r.desc}</Text>
              </View>
              <ToggleSwitch
                value={settings[r.key]}
                onToggle={() => toggle(r.key)}
                accessibilityLabel={r.label}
              />
            </View>
          ))}
        </View>

        {/* 햅틱은 켜고 끄는 것만으로 부족하다 (#974) — 세기를 고른다. 다크 모드
            칩(설정)과 같은 모양이라 이 앱에서 처음 보는 컨트롤이 아니다. */}
        <View style={[styles.card, styles.strengthCard, { backgroundColor: t.surface }]}>
          <Text style={[Typography.body, { color: t.text }]}>
            {tr('member.soundSettings.haptic')}
          </Text>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            {tr('member.soundSettings.hapticDesc')}
          </Text>
          <View style={styles.strengthRow}>
            {strengths.map((opt) => {
              const active = settings.hapticStrength === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => apply({ ...settings, hapticStrength: opt.id })}
                  // 다크 모드 칩과 같은 role — 4지선다에서 하나만 고르는 배타적
                  // 선택이라 button이 아니라 radio가 맞다 (settings-screen과 동일).
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={tr('member.soundSettings.hapticA11y', { label: opt.label })}
                  style={[
                    styles.strengthChip,
                    { backgroundColor: active ? t.primary : t.surfaceMuted },
                  ]}>
                  <Text style={[Typography.label, { color: active ? t.onPrimary : t.textMuted }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  strengthCard: { marginTop: Spacing.three, padding: Spacing.three, gap: Spacing.half },
  strengthRow: { flexDirection: 'row', gap: Spacing.one, marginTop: Spacing.two },
  strengthChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  body: {
    padding: Spacing.three,
  },
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
});
