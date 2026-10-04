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

/**
 * Android는 런처 activity-alias를 켜고 끄는 방식이라, 앱이 떠 있는 동안 바꾸면 지금 태스크를
 * 띄운 alias가 꺼지면서 런처가 창을 닫는다 — 사용자에겐 "앱이 갑자기 꺼짐"이고 크래시가
 * 아니라 Sentry에도 안 남는다. 떠 있는 동안 정한 아이콘은 기억해 뒀다가 앱이 화면을 떠날
 * 때(background) 한 번 적용한다. 마지막 결정만 남긴다.
 */
let deferred: { name: string | null } | null = null;
let deferListening = false;

function deferUntilBackground(name: string | null) {
  deferred = { name };
  if (deferListening) return;
  deferListening = true;
  AppState.addEventListener('change', (next) => {
    if (next === 'background') void flushDeferredAppIcon().catch(() => {});
  });
}

/** 미뤄 둔 Android 아이콘 교체를 적용한다 — 앱이 화면에 있으면 계속 미룬다. */
export function flushDeferredAppIcon() {
  return serial(async () => {
    if (!deferred || AppState.currentState === 'active') return;
    const { name } = deferred;
    deferred = null;
    await setNativeAppIcon(name);
  });
}

/** 테스트용 — 미뤄 둔 교체가 있는지. */
export function hasDeferredAppIcon() {
  return deferred !== null;
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
    if (Platform.OS === 'android' && !background && AppState.currentState === 'active') {
      deferUntilBackground(appIconName(state.state));
      return;
    }
    // 백그라운드 작업의 결정이 더 새롭다 — 미뤄 둔 옛 결정이 다음 전환 때 덮어쓰지 않게.
    // (invalidateAppIconWork에서는 비우지 않는다: 훅이 background 전환 때 그걸 먼저 불러
    // flush보다 앞서 미뤄 둔 결정을 지워 버린다.)
    if (background) deferred = null;
    const changed = await setNativeAppIcon(appIconName(state.state));
    if (changed && background && isCurrent() && revision === expectedRevision) {
      await AsyncStorage.setItem(BACKGROUND_CHANGED_AT, String(Date.now()));
    }
  });
}

export function clearAutomaticAppIcon() {
  invalidateAppIconWork();
  return serial(async () => {
    if (Platform.OS === 'web' || !supportsAppIcons() || AppState.currentState !== 'active') return;
    if (Platform.OS === 'android') deferUntilBackground(null);
    else await setNativeAppIcon(null);
  });
}
