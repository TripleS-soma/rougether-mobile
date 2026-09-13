import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import {
  RECENT_ANNOUNCEMENT_COUNT,
  announcementDateLabel,
  type Announcement,
} from '@/constants/announcements';
import { Radius, Spacing } from '@/constants/theme';
import { useFontEmphasis, useTokens, useTypography } from '@/hooks/use-tokens';

export type AnnouncementRow = Announcement & { read: boolean };

export type AnnouncementSectionProps = {
  announcements: AnnouncementRow[];
  /** 행 탭 — 읽음 처리와 행동(화면 이동·링크)은 호출자가 한다. */
  onOpen?: (announcement: AnnouncementRow) => void;
};

/**
 * 알림 탭 상단 "새 소식" (#1320) — 앱 번들 공지를 개인 알림과 **구분된 톤**
 * (반짝이 아이콘, primarySoft 원)으로 보여준다. 최근 3개만 펼치고 나머지는
 * 더보기로. 개인 알림 행과 같은 높이·간격이라 목록이 한 결로 읽힌다.
 */
export function AnnouncementSection({ announcements, onOpen }: AnnouncementSectionProps) {
  const t = useTokens();
  const Typography = useTypography();
  const emph = useFontEmphasis();
  const [expanded, setExpanded] = useState(false);
  if (announcements.length === 0) return null;
  const hidden = Math.max(0, announcements.length - RECENT_ANNOUNCEMENT_COUNT);
  const visible = expanded ? announcements : announcements.slice(0, RECENT_ANNOUNCEMENT_COUNT);

  return (
    <View style={styles.section} testID="announcement-section">
      <Text style={[Typography.supporting, emph('semibold'), styles.title, { color: t.textMuted }]}>
        새 소식
      </Text>
      {visible.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => onOpen?.(a)}
          accessibilityRole="button"
          accessibilityLabel={a.title}
          accessibilityState={{ selected: !a.read }}
          style={[
            styles.row,
            { backgroundColor: a.read ? t.surfaceMuted : t.surface, borderColor: t.border },
          ]}>
          <View style={[styles.rowIcon, { backgroundColor: t.primarySoft }]}>
            <Icon name="sparkles" size={18} color={t.primaryText} />
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowHead}>
              <Text style={[Typography.label, { color: t.text }]}>{a.title}</Text>
              <Text style={[Typography.supporting, { color: t.textMuted }]}>
                {announcementDateLabel(a.date)}
              </Text>
            </View>
            <Text style={[Typography.body, { color: a.read ? t.textMuted : t.text }]}>
              {a.body}
            </Text>
            {a.action ? (
              <Text style={[Typography.label, { color: t.primaryText }]}>{a.action.label} →</Text>
            ) : null}
          </View>
          {!a.read ? <View style={[styles.unreadDot, { backgroundColor: t.primary }]} /> : null}
        </Pressable>
      ))}
      {hidden > 0 ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? '새 소식 접기' : `지난 소식 ${hidden}개 더보기`}
          style={[styles.more, { backgroundColor: t.surfaceMuted }]}>
          <Text style={[Typography.label, { color: t.primaryText }]}>
            {expanded ? '접기' : `지난 소식 ${hidden}개 더보기`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  title: {
    paddingHorizontal: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.three,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: Spacing.half,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  more: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
