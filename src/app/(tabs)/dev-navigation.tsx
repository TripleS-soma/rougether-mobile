import { Redirect } from 'expo-router';

/** Keep the isolated gesture harness out of production bundles. */
export default function DevNavigationRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  const { NavigationPreview } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/navigation-preview') as typeof import('@/dev/navigation-preview');
  return <NavigationPreview />;
}
