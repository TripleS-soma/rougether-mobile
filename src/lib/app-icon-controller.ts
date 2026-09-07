import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

import type { AppIconResponse } from '@/api/app-icon';
import { appIconName } from '@/constants/app-icons';
import { setNativeAppIcon, supportsAppIcons } from '@/lib/app-icon-native';

const BACKGROUND_CHANGED_AT = 'rougether.app-icon.background-changed-at';
const DAY_MS = 24 * 60 * 60 * 1000;
let revision = 0;
let queue: Promise<unknown> = Promise.resolve();

export function invalidateAppIconWork() {
  revision += 1;
}
export function appIconRevision() {
  return revision;
}
function serial<T>(action: () => Promise<T>): Promise<T> {
  const next = queue.then(action, action);
  queue = next.catch(() => {});
  return next;
}

export function applyAutomaticAppIcon(
  state: AppIconResponse,
  isCurrent: () => boolean,
  expectedRevision: number,
  background = false,
) {
  return serial(async () => {
    if (Platform.OS === 'web' || !supportsAppIcons()) return;
    // UIKit icon changes show a system alert; only request them while the app is active.
    if (Platform.OS === 'ios' && (background || AppState.currentState !== 'active')) return;
    if (background) {
      const last = Number(await AsyncStorage.getItem(BACKGROUND_CHANGED_AT));
      if (last > 0 && Date.now() - last < DAY_MS) return;
    }
    if (!isCurrent() || revision !== expectedRevision) return;
    if (background && AppState.currentState === 'active') return;
    const changed = await setNativeAppIcon(appIconName(state.state));
    if (changed && background && isCurrent() && revision === expectedRevision) {
      await AsyncStorage.setItem(BACKGROUND_CHANGED_AT, String(Date.now()));
    }
  });
}

export function clearAutomaticAppIcon() {
  invalidateAppIconWork();
  return serial(async () => {
    if (Platform.OS !== 'web' && supportsAppIcons() && AppState.currentState === 'active') {
      await setNativeAppIcon(null);
    }
  });
}
