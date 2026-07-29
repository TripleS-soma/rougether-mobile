import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/screen-header';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Radius, Spacing } from '@/constants/theme';
import { useScreenStyle } from '@/hooks/use-screen-style';
import { useTokens, useTypography } from '@/hooks/use-tokens';

/**
 * App model of GET/PATCH /users/me/notification-settings (#495) — 서버와 같은
 * 3항목. 설정을 꺼도 알림함에는 쌓이고 push 발송만 중단된다.
 */
export type NotificationSettings = {
  all: boolean;
  reminder: boolean;
  house: boolean;
};

/** 서버 기본과 동일 — 한 번도 끈 적 없는 항목은 켜짐. */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  all: true,
  reminder: true,
  house: true,
};

type RowKey = Exclude<keyof NotificationSettings, 'all'>;
const ROWS: { key: RowKey; label: string; desc: string }[] = [
  { key: 'reminder', label: '루틴 리마인더', desc: '설정한 시간에 루틴을 알려드려요' },
  { key: 'house', label: '집 알림', desc: '응원과 우리 집 소식을 알려드려요' },
];

export type NotificationSettingsScreenProps = {
  /** Server-backed settings — controlled by the shell (fetch + optimistic PATCH). */
  settings?: NotificationSettings;
  /**
   * One toggle flipped. The parent PATCHes only this key — the server keeps
   * group values under all=false, so no client-side masking is sent.
   */
  onToggle?: (key: keyof NotificationSettings, value: boolean) => void;
  /**
   * True when the server fetch failed (#549) — 기본값이 서버값처럼 보이지
   * 않도록 상단 안내 배너 + 다시 불러오기를 보여준다.
   */
  loadError?: boolean;
  /** Re-fetch the settings (다시 불러오기 button). */
  onRetry?: () => void;
  onBack?: () => void;
};

/**
 * "푸시 알림" settings reached from 설정 → 푸시 알림. A master switch plus
 * per-category toggles (shown off & disabled while the master is off — the
 * server preserves their values). Pure/prop-driven; the app shell owns the
 * server sync.
 */
export function NotificationSettingsScreen({
  settings = DEFAULT_NOTIFICATION_SETTINGS,
  onToggle,
  loadError = false,
  onRetry,
  onBack,
}: NotificationSettingsScreenProps) {
  const t = useTokens();
  const Typography = useTypography();

  return (
    <View style={[styles.screen, useScreenStyle()]}>
      <ScreenHeader title="푸시 알림" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.body}>
        {/* 조회 실패 안내 (#549) — 지금 보이는 값은 기본값일 수 있다. */}
        {loadError ? (
          <View style={[styles.card, styles.errorCard, { backgroundColor: t.surface }]}>
            <Text style={[Typography.body, { color: t.text }]}>
              설정을 불러오지 못했어요. 지금 보이는 값은 실제 설정과 다를 수 있어요.
            </Text>
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="다시 불러오기"
              style={[styles.retryBtn, { backgroundColor: t.primary }]}>
              <Text style={[Typography.label, { color: t.onPrimary }]}>다시 불러오기</Text>
            </Pressable>
          </View>
        ) : null}
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
              onToggle={() => onToggle?.('all', !settings.all)}
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
                  onToggle={() => settings.all && onToggle?.(r.key, !settings[r.key])}
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
  // 조회 실패 배너 (#549).
  errorCard: {
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  retryBtn: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
});
