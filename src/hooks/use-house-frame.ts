import { useMemo, useState } from 'react';

import { type HouseFrameOptions, resolveHouseFrame } from '@/resources/house-frame';

/** Image failure switches geometry and art together, never just the bitmap. */
export function useHouseFrame(key?: string | null, options: HouseFrameOptions = {}) {
  const { maxMembers, minimumSeats, enabled, previewTheme } = options;
  const candidate = useMemo(
    () => resolveHouseFrame(key, { maxMembers, minimumSeats, enabled, previewTheme }),
    [key, maxMembers, minimumSeats, enabled, previewTheme],
  );
  const [failedKey, setFailedKey] = useState<string>();
  const frame = useMemo(
    () =>
      candidate.assetKey === failedKey ? resolveHouseFrame(key, { enabled: false }) : candidate,
    [candidate, failedKey, key],
  );
  return {
    frame,
    onFrameError: () => {
      if (candidate.kind === 'stacked') setFailedKey(candidate.assetKey);
    },
  };
}
