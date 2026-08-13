import { Redirect } from 'expo-router';

/**
 * /dev — component gallery route. Dev/test harness only: production builds
 * redirect home (the route stays reachable via deep link otherwise), and the
 * inline require lets Metro drop the gallery + registry from the prod bundle
 * (__DEV__ is inlined at build time, so the branch below is dead code there).
 */
export default function DevGalleryRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DevGallery } = require('@/dev/gallery') as typeof import('@/dev/gallery');
  return <DevGallery />;
}
