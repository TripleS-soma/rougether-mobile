import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { getSessionUserId } from '@/api/auth';
import { fetchAppIcon, recordAppActivity, type AppIconResponse } from '@/api/app-icon';
import { useAuth } from '@/hooks/use-auth';
import { onAppIconEvent } from '@/lib/app-icon-events';
import {
  appIconRevision,
  applyAutomaticAppIcon,
  clearAutomaticAppIcon,
  invalidateAppIconWork,
} from '@/lib/app-icon-controller';

const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;

async function configureBackground(enabled: boolean) {
  if (Platform.OS !== 'android') return;
  const { setAppIconBackgroundEnabled } = await import('@/lib/app-icon-background');
  await setAppIconBackgroundEnabled(enabled);
}

export function useAppIconSync() {
  const { status } = useAuth();
  const client = useQueryClient();
  const { mutateAsync: record } = useMutation({ mutationFn: recordAppActivity, retry: false });

  useEffect(() => {
    if (Platform.OS === 'web' || status === 'loading') return;
    invalidateAppIconWork();
    if (status !== 'authed') {
      void configureBackground(false).catch(() => {});
      const reset = () => {
        if (AppState.currentState === 'active') void clearAutomaticAppIcon().catch(() => {});
      };
      reset();
      const sub = AppState.addEventListener('change', reset);
      client.removeQueries({ queryKey: ['app-icon'] });
      return () => sub.remove();
    }

    let alive = true;
    let pendingActivity = false;
    let queuedForeground = false;
    let queuedRefresh = false;
    let lastActivity = -Infinity;
    let requestId = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wasActive = false;
    const userId = getSessionUserId();
    const current = () => alive && getSessionUserId() === userId;
    const active = () => current() && AppState.currentState === 'active';
    const key = ['app-icon', userId];

    async function accept(data: AppIconResponse, id: number, version: number) {
      if (!active() || id !== requestId) return;
      client.setQueryData(key, data);
      await applyAutomaticAppIcon(data, () => active() && id === requestId, version);
      if (!active() || id !== requestId) return;
      clearTimeout(timer);
      const at = data.nextEvaluationAt ? Date.parse(data.nextEvaluationAt) : NaN;
      if (Number.isFinite(at)) {
        timer = setTimeout(
          () => {
            void refresh();
          },
          Math.min(24 * 60 * 60 * 1000, Math.max(1000, at - Date.now())),
        );
      }
    }

    async function refresh() {
      if (!active()) return;
      if (pendingActivity) {
        queuedRefresh = true;
        return;
      }
      const id = ++requestId;
      const version = appIconRevision();
      try {
        const data = await client.fetchQuery({
          queryKey: key,
          queryFn: fetchAppIcon,
          staleTime: 0,
          retry: false,
        });
        await accept(data, id, version);
      } catch {
        /* An optional icon must not interrupt routine completion or login. */
      }
    }

    async function foreground(force: boolean) {
      if (!active()) return;
      if (pendingActivity) {
        queuedForeground ||= force;
        return;
      }
      if (!force && Date.now() - lastActivity < ACTIVITY_THROTTLE_MS) return;
      invalidateAppIconWork();
      const version = appIconRevision();
      const id = ++requestId;
      pendingActivity = true;
      try {
        const data = await record();
        if (current()) lastActivity = Date.now();
        await accept(data, id, version);
      } catch {
        /* The next foreground interaction retries. */
      } finally {
        pendingActivity = false;
        if (queuedForeground) {
          queuedForeground = false;
          queuedRefresh = false;
          void foreground(true);
        } else if (queuedRefresh) {
          queuedRefresh = false;
          void refresh();
        }
      }
    }

    void configureBackground(true).catch(() => {});
    const entered = () => {
      if (AppState.currentState === 'active') {
        if (!wasActive) void foreground(true);
        wasActive = true;
      } else {
        wasActive = false;
        clearTimeout(timer);
        requestId += 1;
        invalidateAppIconWork();
      }
    };
    entered();
    const subscription = AppState.addEventListener('change', entered);
    const unsubscribe = onAppIconEvent((event) => {
      if (event === 'foreground') void foreground(false);
      else void refresh();
    });
    return () => {
      alive = false;
      invalidateAppIconWork();
      clearTimeout(timer);
      subscription.remove();
      unsubscribe();
    };
  }, [status, client, record]);
}
