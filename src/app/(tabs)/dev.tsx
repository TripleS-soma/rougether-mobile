import { Redirect } from 'expo-router';

/**
 * /dev — component gallery route. Dev/test harness only: production builds
 * redirect home (the route stays reachable via deep link otherwise). The
 * inline require alone does NOT drop the gallery from the prod bundle (Metro
 * collects the dependency first) — metro.config.js resolves `@/dev/*` to an
 * empty module outside dev builds.
 */
export default function DevGalleryRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DevGallery } = require('@/dev/gallery') as typeof import('@/dev/gallery');
  return <DevGallery />;
}
