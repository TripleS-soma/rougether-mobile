import { useEffect, useMemo, useState } from 'react';

import { type HouseFrameOptions, resolveHouseFrame } from '@/resources/house-frame';

/** Image failure switches geometry and art together, never just the bitmap. */
export function useHouseFrame(key?: string | null, options: HouseFrameOptions = {}) {
  const { maxMembers, minimumSeats, enabled, previewTheme, failureScope, displayMode } = options;
  const candidate = useMemo(
    () => resolveHouseFrame(key, { maxMembers, minimumSeats, enabled, previewTheme, displayMode }),
    [key, maxMembers, minimumSeats, enabled, previewTheme, displayMode],
  );
  const [failure, setFailure] = useState<{ key: string; scope?: string | number }>();
  useEffect(() => setFailure(undefined), [candidate.assetKey, failureScope]);
  const frame = useMemo(
    () =>
      candidate.assetKey === failure?.key && failure.scope === failureScope
        ? resolveHouseFrame(key, { enabled: false, displayMode })
        : candidate,
    [candidate, failure, failureScope, key, displayMode],
  );
  return {
    frame,
    onFrameError: () => {
      if (candidate.kind === 'stacked')
        setFailure({ key: candidate.assetKey, scope: failureScope });
    },
  };
}
