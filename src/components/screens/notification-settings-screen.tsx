import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/screen-header';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens } from '@/hooks/use-tokens';

export type NotificationSettings = {
  all: boolean;
  routineReminder: boolean;
  friendCheer: boolean;
  groupActivity: boolean;
  marketing: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  all: true,
  routineReminder: true,
  friendCheer: true,
  groupActivity: true,
  marketing: false,
};

type RowKey = Exclude<keyof NotificationSettings, 'all'>;
const ROWS: { key: RowKey; label: string; desc: string }[] = [
  { key: 'routineReminder', label: '루틴 리마인더', desc: '설정한 시간에 루틴을 알려드려요' },
  { key: 'friendCheer', label: '친구 응원 알림', desc: '친구가 응원을 보내면 알려드려요' },
  { key: 'groupActivity', label: '그룹 활동 알림', desc: '우리 집 소식을 알려드려요' },
  { key: 'marketing', label: '마케팅 정보 수신', desc: '이벤트와 혜택 소식을 받아요' },
];

export type NotificationSettingsScreenProps = {
  initialSettings?: NotificationSettings;
  onChange?: (settings: NotificationSettings) => void;
  onBack?: () => void;
};

/**
 * "푸시 알림" settings reached from 설정 → 푸시 알림. A master switch plus
 * per-category toggles (disabled while the master is off). Pure/prop-driven;
 * the app shell persists via onChange.
 */
export function NotificationSettingsScreen({
  initialSettings = DEFAULT_NOTIFICATION_SETTINGS,
  onChange,
  onBack,
}: NotificationSettingsScreenProps) {
  const t = useTokens();
  const [settings, setSettings] = useState(initialSettings);

  const update = (next: NotificationSettings) => {
    setSettings(next);
    onChange?.(next);
  };

  return (
    <View style={[styles.screen, useScreenStyle()]}>
      <ScreenHeader title="푸시 알림" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: t.surface }]}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={[Typography.body, { color: t.text }]}>전체 알림</Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                모든 푸시 알림을 한 번에 켜고 꺼요
              </Text>
            </View>
            <ToggleSwitch
              value={settings.all}
              onToggle={() => update({ ...settings, all: !settings.all })}
              accessibilityLabel="전체 알림"
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: t.surface }]}>
          {ROWS.map((r, idx) => {
            const value = settings.all && settings[r.key];
            return (
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
                  <Text
                    style={[Typography.body, { color: settings.all ? t.text : t.textDisabled }]}>
                    {r.label}
                  </Text>
                  <Text style={[Typography.supporting, { color: t.textMuted }]}>{r.desc}</Text>
                </View>
                <ToggleSwitch
                  value={value}
                  onToggle={() =>
                    settings.all && update({ ...settings, [r.key]: !settings[r.key] })
                  }
                  accessibilityLabel={r.label}
                />
              </View>
            );
          })}
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
    gap: Spacing.three,
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
