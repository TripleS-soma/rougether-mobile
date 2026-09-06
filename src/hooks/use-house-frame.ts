import { useEffect, useMemo, useState } from 'react';

import { type HouseFrameOptions, resolveHouseFrame } from '@/resources/house-frame';

/** Image failure switches geometry and art together, never just the bitmap. */
export function useHouseFrame(key?: string | null, options: HouseFrameOptions = {}) {
  const { maxMembers, minimumSeats, enabled, previewTheme, failureScope } = options;
  const candidate = useMemo(
    () => resolveHouseFrame(key, { maxMembers, minimumSeats, enabled, previewTheme }),
    [key, maxMembers, minimumSeats, enabled, previewTheme],
  );
  const [failure, setFailure] = useState<{ key: string; scope?: string | number }>();
  useEffect(() => setFailure(undefined), [candidate.assetKey, failureScope]);
  const frame = useMemo(
    () =>
      candidate.assetKey === failure?.key && failure.scope === failureScope
        ? resolveHouseFrame(key, { enabled: false })
        : candidate,
    [candidate, failure, failureScope, key],
  );
  return {
    frame,
    onFrameError: () => {
      if (candidate.kind === 'stacked')
        setFailure({ key: candidate.assetKey, scope: failureScope });
    },
  };
}
