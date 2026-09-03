import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/screen-header';
import type { PushRegistrationStep } from '@/lib/push-token';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Radius, Spacing } from '@/constants/theme';
import { useHeaderContentInset, useScreenStyle } from '@/hooks/use-screen-style';
import { useResponsiveColumn } from '@/hooks/use-responsive-column';
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
  /**
   * 이 기기의 푸시 등록이 어디서 끝났는지 (#903). 알림 설정을 다 켜뒀는데도
   * 안 오는 경우, 서버가 아니라 **이 기기가 등록조차 안 된 것**일 수 있다 —
   * 그 구분이 화면에 없어서 아무도 몰랐다. 생략하면 상태 줄을 안 그린다.
   */
  pushStep?: PushRegistrationStep;
  onBack?: () => void;
};

/**
 * 등록 단계 → 사용자에게 할 말. 정상(registered)과 "볼 필요 없는" 경우
 * (idle·unsupported·no-device)는 줄을 안 그린다 — 잘 되고 있을 때 굳이
 * 기술 상태를 보여줄 이유가 없다.
 */
const PUSH_STEP_NOTICE: Partial<Record<PushRegistrationStep, string>> = {
  'permission-denied': '기기에서 알림이 꺼져 있어요. 시스템 설정의 알림에서 켜야 푸시가 도착해요.',
  'token-failed': '이 기기를 알림 서버에 등록하지 못했어요. 앱을 다시 켜보고, 계속되면 알려주세요.',
  'register-failed': '이 기기 등록이 저장되지 않았어요. 네트워크를 확인하고 앱을 다시 켜보세요.',
};

export function pushStepNotice(step?: PushRegistrationStep): string | undefined {
  return step ? PUSH_STEP_NOTICE[step] : undefined;
}

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
  pushStep,
  onBack,
}: NotificationSettingsScreenProps) {
  const t = useTokens();
  const column = useResponsiveColumn();
  // 떠 있는 글래스 헤더(#1069) 밑으로 콘텐츠가 지나가도록 상단 패딩.
  const headerInset = useHeaderContentInset();
  const Typography = useTypography();

  return (
    <View style={[styles.screen, useScreenStyle([])]}>
      <ScreenHeader title="푸시 알림" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.body,
          column,
          headerInset ? { paddingTop: headerInset } : null,
        ]}>
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
        {/* 이 기기가 알림을 못 받는 상태면 토글보다 먼저 말해준다 (#903) —
            설정을 아무리 켜도 등록이 안 됐으면 푸시는 안 온다. */}
        {pushStepNotice(pushStep) ? (
          <View
            testID="push-status-notice"
            style={[styles.card, { backgroundColor: t.warningSoft }]}>
            <Text style={[Typography.body, { color: t.text }]}>{pushStepNotice(pushStep)}</Text>
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
