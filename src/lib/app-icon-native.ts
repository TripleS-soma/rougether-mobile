import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type IconModule = {
  getAppIconName(): string | null;
  setAlternateAppIcon(name: string | null): Promise<string | null>;
  supportsAlternateIcons?: boolean;
};

function native(): IconModule | null {
  if (Platform.OS === 'web') return null;
  return requireOptionalNativeModule<IconModule>(
    Platform.OS === 'android' ? 'RougetherAppIcon' : 'ExpoAlternateAppIcons',
  );
}
export function supportsAppIcons() {
  const module = native();
  return module !== null && module.supportsAlternateIcons !== false;
}
export function getNativeAppIcon() {
  return native()?.getAppIconName() ?? null;
}
export async function setNativeAppIcon(name: string | null) {
  const module = native();
  if (!module) throw new Error('App icons are unavailable in this build');
  if (module.getAppIconName() === name) return false;
  await module.setAlternateAppIcon(name);
  return true;
}
