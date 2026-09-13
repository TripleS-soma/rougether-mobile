import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass-surface';
import { Radius, Spacing } from '@/constants/theme';
import { useTokens, useTypography } from '@/hooks/use-tokens';

export type NotificationTab = 'notifications' | 'news';

export type NotificationTabsProps = {
  value: NotificationTab;
  onChange: (tab: NotificationTab) => void;
  /** 탭 라벨 옆 안 읽음 점 — 개인 알림·새 소식 각각. */
  unread: { notifications: boolean; news: boolean };
};

const TABS: readonly { key: NotificationTab; label: string }[] = [
  // 헤더 제목이 이미 '알림'이라 탭은 '내 알림'으로 — 새 소식(전체 공지)과의 대비도 분명해진다.
  { key: 'notifications', label: '내 알림' },
  { key: 'news', label: '새 소식' },
];

/**
 * 알림 화면의 [알림 | 새 소식] 세그먼트 (#1320) — 개인 알림과 앱 공지를 한 목록에
 * 섞지 않고 탭으로 가른다. 나의 방의 방/달력 알약과 같은 모양.
 */
export function NotificationTabs({ value, onChange, unread }: NotificationTabsProps) {
  const t = useTokens();
  const Typography = useTypography();
  return (
    <View style={styles.row} testID="notification-tabs">
      <GlassSurface interactive={false} fallbackColor={t.surface} style={styles.segment}>
        {TABS.map(({ key, label }) => {
          const active = value === key;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label} 탭`}
              style={[styles.item, active && { backgroundColor: t.surfaceMuted }]}>
              <Text style={[Typography.label, { color: active ? t.primaryText : t.textMuted }]}>
                {label}
              </Text>
              {unread[key] ? (
                <View
                  testID={`notification-tab-dot-${key}`}
                  style={[styles.dot, { backgroundColor: t.primary }]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
  },
});
