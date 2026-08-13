/**
 * App/device identification strings attached to bug reports (#496) so the
 * team can reproduce without asking the reporter.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/** App version from app.json (e.g. "1.0.3"); undefined if unresolvable. */
export function appVersion(): string | undefined {
  return Constants.expoConfig?.version ?? undefined;
}

/** One-line device summary, e.g. "Apple iPhone 15 / iOS 18.1" or "web". */
export function deviceInfo(): string {
  const model = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ');
  const os = [Device.osName ?? Platform.OS, Device.osVersion].filter(Boolean).join(' ');
  return [model, os].filter(Boolean).join(' / ') || Platform.OS;
}
