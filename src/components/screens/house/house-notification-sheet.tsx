import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PendingNotice } from '@/components/ui/pending-notice';
import { SheetHandle } from '@/components/ui/sheet-handle';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** 집 피드 새 글 푸시 스위치 두 개의 키 — 서버 필드 이름 그대로. */
export type HouseFeedPushField = 'freePostPush' | 'verificationPostPush';

export type HouseNotificationSheetProps = {
  visible: boolean;
  onClose?: () => void;
  /**
   * 채팅 알림 — `on`은 "알림을 받는다"(음소거의 반대). 없으면(방 상태를 아직 모름) 줄을 잠근다.
   */
  chat?: { on: boolean; onToggle?: () => void };
  /**
   * 새 글 알림 두 줄. 없으면 그리지 않는다(피드가 꺼진 설치본).
   * - `loading`: 아직 못 받았다 — 기본값을 흐리게 그리고 누를 수 없다.
   * - `unavailable`: 서버에 설정 API가 아직 없거나 받지 못했다 — 잠그고 안내한다.
   */
  feed?: {
    state: 'ready' | 'loading' | 'unavailable';
    freePostPush: boolean;
    verificationPostPush: boolean;
    onToggle?: (field: HouseFeedPushField) => void;
  };
};

type Row = {
  key: string;
  label: string;
  desc: string;
  value: boolean;
  enabled: boolean;
  onToggle?: () => void;
};

/**
 * "이 집 알림" 시트 (집 피드) — 집 채팅 화면과 집 피드 목록의 종 버튼이 같이 연다. 채팅·자유글·
 * 인증글 푸시를 이 집에 한해 끄고 켠다. 줄 모양은 푸시 알림 설정 화면과 같다(이름 + 설명 + 스위치).
 * 순수·prop 기반: 값과 저장은 셸(`use-house-notifications`)이 넘긴다.
 */
export function HouseNotificationSheet({
  visible,
  onClose,
  chat,
  feed,
}: HouseNotificationSheetProps) {
  const t = useTokens();
  const Typography = useTypography();
  const tr = useT();

  const feedReady = feed?.state === 'ready';
  const rows: Row[] = [
    {
      key: 'chat',
      label: tr('house.notification.chat'),
      desc: tr('house.notification.chatDesc'),
      value: chat?.on ?? false,
      enabled: !!chat?.onToggle,
      onToggle: chat?.onToggle,
    },
    ...(feed
      ? [
          {
            key: 'freePostPush',
            label: tr('house.notification.freePost'),
            desc: tr('house.notification.freePostDesc'),
            value: feed.freePostPush,
            enabled: feedReady && !!feed.onToggle,
            onToggle: () => feed.onToggle?.('freePostPush'),
          },
          {
            key: 'verificationPostPush',
            label: tr('house.notification.verificationPost'),
            desc: tr('house.notification.verificationPostDesc'),
            value: feed.verificationPostPush,
            enabled: feedReady && !!feed.onToggle,
            onToggle: () => feed.onToggle?.('verificationPostPush'),
          },
        ]
      : []),
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={tr('house.notification.title')}
      nativeDrag
      cardStyle={[styles.sheet, { backgroundColor: t.screen }]}>
      <SheetHandle />
      <Text style={[Typography.h3, { color: t.text }]}>{tr('house.notification.title')}</Text>
      <View style={[styles.card, { backgroundColor: t.surface }]}>
        {rows.map((row, idx) => (
          <View
            key={row.key}
            testID={`house-notification-${row.key}`}
            style={[
              styles.row,
              idx !== rows.length - 1 && {
                borderBottomColor: t.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}>
            <View style={styles.rowText}>
              <Text style={[Typography.body, { color: row.enabled ? t.text : t.textDisabled }]}>
                {row.label}
              </Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>{row.desc}</Text>
            </View>
            <View style={row.enabled ? null : styles.locked}>
              <ToggleSwitch
                value={row.value}
                onToggle={() => {
                  if (row.enabled) row.onToggle?.();
                }}
                accessibilityLabel={row.label}
              />
            </View>
          </View>
        ))}
      </View>
      {feed?.state === 'unavailable' ? (
        <PendingNotice text={tr('house.notification.feedPending')} />
      ) : null}
      <Text style={[Typography.supporting, { color: t.textMuted }]}>
        {tr('house.notification.footer')}
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  card: {
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  locked: {
    opacity: 0.5,
  },
});
