import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';

import { getAccessToken, getSessionUserId, loadSession } from '@/api/auth';
import { fetchAppIcon } from '@/api/app-icon';
import { appIconRevision, applyAutomaticAppIcon } from '@/lib/app-icon-controller';

export const APP_ICON_TASK = 'rougether-app-icon-state';

// A headless invocation only reads server state. Never record foreground from here.
export async function refreshBackgroundAppIcon() {
  if (Platform.OS !== 'android' || AppState.currentState === 'active') return;
  const version = appIconRevision();
  if (!getAccessToken()) await loadSession(() => appIconRevision() === version);
  if (!getAccessToken() || appIconRevision() !== version) return;
  const userId = getSessionUserId();
  const response = await fetchAppIcon();
  await applyAutomaticAppIcon(
    response,
    () => !!getAccessToken() && getSessionUserId() === userId,
    version,
    true,
  );
}

if (Platform.OS === 'android' && !TaskManager.isTaskDefined(APP_ICON_TASK)) {
  TaskManager.defineTask(APP_ICON_TASK, async () => {
    try {
      await refreshBackgroundAppIcon();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function setAppIconBackgroundEnabled(enabled: boolean) {
  if (Platform.OS !== 'android') return;
  const registered = await TaskManager.isTaskRegisteredAsync(APP_ICON_TASK);
  if (enabled && !registered)
    await BackgroundTask.registerTaskAsync(APP_ICON_TASK, { minimumInterval: 60 });
  if (!enabled && registered) await BackgroundTask.unregisterTaskAsync(APP_ICON_TASK);
}
