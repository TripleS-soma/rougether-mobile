import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DEFAULT_HAPTIC_STRENGTH, type HapticStrength } from '@/utils/haptics';
import { PendingNotice } from '@/components/ui/pending-notice';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Radius, Spacing } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
import { useTokens, useTypography } from '@/hooks/use-tokens';

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

const ROWS: { key: ToggleKey; label: string; desc: string }[] = [
  { key: 'effects', label: '효과음', desc: '버튼과 뽑기 등에서 소리가 나요' },
  { key: 'music', label: '배경 음악', desc: '방에 있을 때 잔잔한 음악이 흘러요' },
];

/** 햅틱 세기 (#974) — 켜고 끄는 것만으로는 '너무 세다'를 해결할 수 없었다. */
const STRENGTHS: { id: HapticStrength; label: string }[] = [
  { id: 'off', label: '끄기' },
  { id: 'light', label: '약' },
  { id: 'medium', label: '보통' },
  { id: 'heavy', label: '강' },
];

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
  const Typography = useTypography();
  const [settings, setSettings] = useState(initialSettings);

  const apply = (next: SoundSettings) => {
    setSettings(next);
    onChange?.(next);
  };
  const toggle = (key: ToggleKey) => apply({ ...settings, [key]: !settings[key] });

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="효과음" onBack={onBack} />

      <ScrollView contentContainerStyle={[styles.body, column]}>
        <PendingNotice text="사운드 설정은 서버 준비 중이라 아직 이 기기에만 저장돼요." />
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          {ROWS.map((r, idx) => (
            <View
              key={r.key}
              style={[
                styles.row,
                idx !== ROWS.length - 1 && {
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
          <Text style={[Typography.body, { color: t.text }]}>햅틱 진동</Text>
          <Text style={[Typography.supporting, { color: t.textMuted }]}>
            주요 동작에서 진동으로 알려드려요
          </Text>
          <View style={styles.strengthRow}>
            {STRENGTHS.map((opt) => {
              const active = settings.hapticStrength === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => apply({ ...settings, hapticStrength: opt.id })}
                  // 다크 모드 칩과 같은 role — 4지선다에서 하나만 고르는 배타적
                  // 선택이라 button이 아니라 radio가 맞다 (settings-screen과 동일).
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`햅틱 ${opt.label}`}
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
