import { useCallback, useEffect, useMemo, useState } from 'react';

import { type Announcement, getAnnouncements } from '@/constants/announcements';
import { useT } from '@/i18n';
import { loadReadAnnouncements, saveReadAnnouncements } from '@/lib/announcements-store';

export type AnnouncementEntry = Announcement & { read: boolean };

const EMPTY: ReadonlySet<string> = new Set();

/**
 * 번들 공지 + 계정별 읽음 상태 (#1320). 읽음 집합을 불러오기 전에는 전부
 * 읽은 것으로 취급한다 — 벨 배지가 로드 순간 깜빡이지 않게.
 */
export function useAnnouncements(userId: number | undefined) {
  const [read, setRead] = useState<ReadonlySet<string> | null>(null);
  const tr = useT();

  useEffect(() => {
    let alive = true;
    setRead(null);
    void loadReadAnnouncements(userId).then((loaded) => {
      if (alive) setRead(loaded);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const persist = useCallback(
    (next: ReadonlySet<string>) => {
      setRead(next);
      void saveReadAnnouncements(userId, next);
    },
    [userId],
  );
  const markRead = useCallback(
    (id: string) => {
      const current = read ?? EMPTY;
      if (current.has(id)) return;
      persist(new Set([...current, id]));
    },
    [persist, read],
  );
  const markAllRead = useCallback(() => {
    persist(new Set(getAnnouncements(tr).map((a) => a.id)));
  }, [persist, tr]);

  const items = useMemo<AnnouncementEntry[]>(
    () => getAnnouncements(tr).map((a) => ({ ...a, read: read == null || read.has(a.id) })),
    [read, tr],
  );
  const unreadCount = useMemo(() => items.filter((a) => !a.read).length, [items]);

  return useMemo(
    () => ({ items, unreadCount, markRead, markAllRead }),
    [items, unreadCount, markRead, markAllRead],
  );
}
