/**
 * Server-backed push notification settings (#495) —
 * GET /users/me/notification-settings on demand, then an optimistic PATCH per
 * toggle. The server PATCH is partial (only the flipped key travels) and keeps
 * group values under all=false, so rollback is just flipping the key back.
 */
import { useCallback, useState } from 'react';

import { fetchNotificationSettings, updateNotificationSettings } from '@/api';
import { toNotificationSettings } from '@/api/adapters';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '@/components/screens/notification-settings-screen';

export function useNotificationSettings(onError?: (message: string) => void) {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  // 조회 실패 (#549) — 기본값이 서버값처럼 보이지 않도록 화면이 안내 배너
  // + 다시 불러오기를 보여준다. 재조회 성공 시 해제.
  const [loadError, setLoadError] = useState(false);

  /** Refresh from the server (call when the settings screen opens). */
  const load = useCallback(async () => {
    try {
      setSettings(toNotificationSettings(await fetchNotificationSettings()));
      setLoadError(false);
    } catch {
      // Keep defaults/last-known — the screen stays usable and a failing
      // PATCH will surface its own error; the banner says values may differ.
      setLoadError(true);
    }
  }, []);

  const toggle = useCallback(
    (key: keyof NotificationSettings, value: boolean) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      updateNotificationSettings({ [key]: value })
        .then((res) => setSettings(toNotificationSettings(res)))
        .catch(() => {
          setSettings((prev) => ({ ...prev, [key]: !value }));
          onError?.('알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
        });
    },
    [onError],
  );

  return { settings, loadError, load, toggle };
}
