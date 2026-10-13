import { useState } from 'react';
import { View } from 'react-native';
import { NotificationListScreen } from '@/components/screens/notification-list-screen';
import { AnnouncementSection } from '@/components/notifications/announcement-section';
import {
  NotificationTabs,
  type NotificationTab,
} from '@/components/notifications/notification-tabs';
import { getAnnouncements } from '@/constants/announcements';
import { NotificationSettingsScreen } from '@/components/screens/notification-settings-screen';
import type { GalleryEntry } from '@/dev/registry/types';

/** 알림 화면 탭 데모 (#1320) — 탭 전환과 안 읽음 점을 독립적으로 본다. */
function NotificationTabsDemo() {
  const [tab, setTab] = useState<NotificationTab>('notifications');
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <NotificationTabs
        value={tab}
        onChange={setTab}
        unread={{ notifications: tab !== 'notifications', news: tab !== 'news' }}
      />
    </View>
  );
}

export const notificationEntries: GalleryEntry[] = [
  {
    name: 'NotificationListScreen',
    description:
      '나의 방 헤더 벨 → 알림 목록: [알림 | 새 소식] 탭(#1320), 안 읽음 점 + 개별/전체 읽음, 헤더 전체 삭제(확인 다이얼로그). 스와이프 삭제(#1137)는 onDelete를 넘긴 실제 화면에서만 켜진다.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <NotificationListScreen
          announcements={getAnnouncements().map((a, i) => ({ ...a, read: i > 0 }))}
        />
      </View>
    ),
  },
  {
    name: 'NotificationTabs',
    description:
      '알림 화면 [내 알림 | 새 소식] 세그먼트 (#1320): 선택 상태와 안 읽음 점. 본 탭은 점이 꺼진다.',
    render: () => <NotificationTabsDemo />,
  },
  {
    name: 'AnnouncementSection',
    description: '알림 목록 상단 새 소식 (#1320): 번들 공지, 안 읽음 점, 행동 라벨, 더보기 접힘.',
    render: () => (
      <View style={{ alignSelf: 'stretch' }}>
        <AnnouncementSection
          announcements={[
            ...getAnnouncements().map((a, i) => ({ ...a, read: i > 0 })),
            {
              id: 'demo-old',
              date: '2026-09-01',
              title: '지난 소식 예시',
              body: '더보기로 접히는 네 번째 항목.',
              read: true,
            },
          ]}
        />
      </View>
    ),
  },
  {
    name: 'NotificationSettingsScreen',
    description: '설정 → 푸시 알림: 전체 스위치 + 카테고리별 토글.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <NotificationSettingsScreen />
      </View>
    ),
  },
];
