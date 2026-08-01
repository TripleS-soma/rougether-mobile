/**
 * House cover catalog (server GET /houses/cover-images), loaded once on mount.
 * Failure is non-fatal: the create/edit forms simply hide the cover section.
 */
import { useEffect, useState } from 'react';

import { fetchHouseCoverImages } from '@/api';
import { toHouseCover } from '@/api/adapters';
import type { HouseCover } from '@/components/room/house-cover-picker';

export function useHouseCovers() {
  const [covers, setCovers] = useState<HouseCover[]>([]);

  useEffect(() => {
    let active = true;
    fetchHouseCoverImages()
      .then((items) => {
        if (active) setCovers(items.map(toHouseCover).filter((c): c is HouseCover => c !== null));
      })
      .catch(() => {
        // Non-fatal: cover selection just doesn't show.
      });
    return () => {
      active = false;
    };
  }, []);

  return { covers };
}
