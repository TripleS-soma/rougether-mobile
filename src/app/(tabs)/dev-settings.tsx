import { Redirect } from 'expo-router';

/** Keep simulated update controls out of production routes. */
export default function DevSettingsRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  const { SettingsUpdatePreview } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/settings-update-preview') as typeof import('@/dev/settings-update-preview');
  return <SettingsUpdatePreview />;
}
