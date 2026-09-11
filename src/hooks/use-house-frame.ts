import { useEffect, useMemo, useState } from 'react';

import { useResolvedScheme } from '@/hooks/use-tokens';
import { type HouseFrameOptions, resolveHouseFrame } from '@/resources/house-frame';

/** Failures switch geometry and art together: scene → stacked → legacy. */
export function useHouseFrame(key?: string | null, options: HouseFrameOptions = {}) {
  const { maxMembers, minimumSeats, enabled, integratedEnabled, previewTheme, failureScope } =
    options;
  const scheme = useResolvedScheme();
  const candidate = useMemo(
    () =>
      resolveHouseFrame(key, {
        maxMembers,
        minimumSeats,
        enabled,
        integratedEnabled,
        previewTheme,
        scheme,
      }),
    [key, maxMembers, minimumSeats, enabled, integratedEnabled, previewTheme, scheme],
  );
  const [failure, setFailure] = useState<{ keys: string[]; scope?: string | number }>();
  useEffect(() => setFailure(undefined), [candidate.assetKey, failureScope]);
  const frame = useMemo(() => {
    const failed = (assetKey: string) =>
      failure?.scope === failureScope && failure?.keys.includes(assetKey);
    if (!failed(candidate.assetKey)) return candidate;
    const stacked = resolveHouseFrame(key, {
      maxMembers,
      minimumSeats,
      enabled,
      integratedEnabled: false,
      previewTheme,
    });
    if (candidate.kind === 'integrated' && !failed(stacked.assetKey)) return stacked;
    return resolveHouseFrame(key, { enabled: false });
  }, [candidate, failure, failureScope, key, maxMembers, minimumSeats, enabled, previewTheme]);
  return {
    frame,
    onFrameError: () => {
      if (frame.kind !== 'legacy')
        setFailure((previous) => ({
          keys: [
            ...(previous && previous.scope === failureScope ? previous.keys : []),
            frame.assetKey,
          ],
          scope: failureScope,
        }));
    },
  };
}
