import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/screen-header';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

export type SoundSettings = {
  effects: boolean;
  music: boolean;
  haptics: boolean;
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  effects: true,
  music: false,
  haptics: true,
};

const ROWS: { key: keyof SoundSettings; label: string; desc: string }[] = [
  { key: 'effects', label: '효과음', desc: '버튼과 뽑기 등에서 소리가 나요' },
  { key: 'music', label: '배경 음악', desc: '방에 있을 때 잔잔한 음악이 흘러요' },
  { key: 'haptics', label: '햅틱 진동', desc: '주요 동작에서 진동으로 알려드려요' },
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
  const [settings, setSettings] = useState(initialSettings);

  const toggle = (key: keyof SoundSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    onChange?.(next);
  };

  return (
    <View style={[styles.screen, useScreenStyle()]}>
      <ScreenHeader title="효과음" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
